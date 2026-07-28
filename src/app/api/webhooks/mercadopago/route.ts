import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/mercadopago";

// ================================================================
// Webhook do Mercado Pago — confirmação automática de pagamento.
//
// Fluxo: MP notifica -> validamos assinatura -> buscamos o pagamento
// na API do MP (fonte da verdade, nunca confiamos só no payload) ->
// gravamos/atualizamos soma.pagamentos (idempotente via
// ds_webhook_id) -> se aprovado, marcamos o orçamento como 'pago' e
// garantimos que o comprador tenha uma conta pra acompanhar o
// processo (convite por e-mail, via Supabase Auth).
// ================================================================

function validarAssinatura(request: NextRequest, dataId: string): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return false;

  const partes = Object.fromEntries(
    xSignature.split(",").map((parte) => {
      const [chave, valor] = parte.split("=");
      return [chave?.trim(), valor?.trim()];
    })
  );
  const ts = partes.ts;
  const v1 = partes.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hashEsperado = createHmac("sha256", secret).update(manifest).digest("hex");

  const bufferEsperado = Buffer.from(hashEsperado, "hex");
  const bufferRecebido = Buffer.from(v1, "hex");
  if (bufferEsperado.length !== bufferRecebido.length) return false;

  return timingSafeEqual(bufferEsperado, bufferRecebido);
}

interface MercadoPagoPayment {
  id: number;
  status: "pending" | "approved" | "rejected" | "cancelled" | "refunded" | "in_process";
  payment_method_id: string;
  payment_type_id: string;
  installments: number | null;
  transaction_amount: number;
  external_reference: string | null; // esperado: cd_orcamento
  point_of_interaction?: { transaction_data?: { qr_code?: string } };
  payer?: {
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
  // Preenchido em pagamento-actions.ts quando o comprador diz, na tela
  // "você já tem conta?", que já é cadastrado — prevalece sobre
  // payer.email (que é só o e-mail do pagamento, pode ser outro).
  metadata?: { email_conta_existente?: string | null } | null;
}

async function buscarPagamentoNoMercadoPago(paymentId: string): Promise<MercadoPagoPayment> {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar pagamento ${paymentId} no Mercado Pago: ${response.status}`);
  }

  return response.json();
}

const STATUS_MP_PARA_SOMA: Record<MercadoPagoPayment["status"], "pendente" | "confirmado" | "estornado" | "falhou"> = {
  pending: "pendente",
  in_process: "pendente",
  approved: "confirmado",
  refunded: "estornado",
  rejected: "falhou",
  cancelled: "falhou",
};

// Garante que o comprador tenha login no sistema pra acompanhar o
// processo (documentos, andamentos, pendências, orçamento) depois de
// pagar. Se já existir um soma.usuarios com esse e-mail (cliente
// recorrente), só vincula o processo a ele — não cria conta duplicada.
// Se não existir, convida por e-mail via Supabase Auth (o link do
// convite leva a /auth/definir-senha, onde a pessoa cria a senha e
// já entra logada).
async function garantirContaComprador(
  supabase: ReturnType<typeof createServiceRoleClient>,
  cdProcesso: string,
  email: string | null | undefined,
  nomeSugerido: string | null
) {
  if (!email) return;

  const { data: usuarioExistente } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("cd_usuario")
    .eq("ds_email", email)
    .maybeSingle();

  let cdUsuario = usuarioExistente?.cd_usuario as string | undefined;

  if (!cdUsuario) {
    const siteUrl = getSiteUrl();
    const { data: convite, error: erroConvite } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: siteUrl ? `${siteUrl}/auth/definir-senha` : undefined,
    });

    if (erroConvite || !convite?.user) {
      console.error("Erro ao convidar comprador:", erroConvite);
      return;
    }

    const { error: erroUsuario } = await supabase.schema("soma").from("usuarios").insert({
      cd_usuario: convite.user.id,
      nm_usuario: nomeSugerido || email,
      ds_email: email,
      tp_role: "comprador",
      sn_ativo: true,
    });

    if (erroUsuario) {
      console.error("Erro ao criar soma.usuarios do comprador:", erroUsuario);
      return;
    }

    cdUsuario = convite.user.id;
  }

  // Só vincula se o processo ainda não tiver comprador — não sobrescreve
  // um vínculo já existente.
  await supabase
    .schema("soma")
    .from("processos")
    .update({ cd_comprador: cdUsuario })
    .eq("cd_processo", cdProcesso)
    .is("cd_comprador", null);

  await supabase.schema("soma").from("andamentos").insert({
    cd_processo: cdProcesso,
    nm_etapa: "Acesso do comprador liberado",
    ds_andamento: usuarioExistente
      ? `Processo vinculado à conta já existente (${email}).`
      : `Convite de acesso enviado para ${email} — o comprador poderá acompanhar o processo pelo sistema assim que definir a senha.`,
  });
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic");

  if (!dataId) {
    return NextResponse.json({ erro: "data.id ausente na notificação." }, { status: 400 });
  }

  // Só nos importam notificações de pagamento — a URL de webhook do MP
  // recebe outros tópicos (merchant_order, etc.) que ignoramos.
  if (tipo && tipo !== "payment") {
    return NextResponse.json({ ignorado: true });
  }

  if (!validarAssinatura(request, dataId)) {
    return NextResponse.json({ erro: "Assinatura inválida." }, { status: 401 });
  }

  const webhookId = request.headers.get("x-request-id") ?? dataId;

  const supabase = createServiceRoleClient();

  // Idempotência: se já processamos essa notificação, não faz nada de novo.
  const { data: existente } = await supabase
    .schema("soma")
    .from("pagamentos")
    .select("cd_pagamento")
    .eq("ds_webhook_id", webhookId)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ ok: true, ja_processado: true });
  }

  const pagamentoMp = await buscarPagamentoNoMercadoPago(dataId);

  const cdOrcamento = pagamentoMp.external_reference;
  if (!cdOrcamento) {
    return NextResponse.json(
      { erro: "external_reference (cd_orcamento) ausente no pagamento do Mercado Pago." },
      { status: 422 }
    );
  }

  const tpStatus = STATUS_MP_PARA_SOMA[pagamentoMp.status];
  const tpMetodo = pagamentoMp.payment_type_id === "credit_card" ? "cartao" : "pix";

  const { error: erroPagamento } = await supabase.schema("soma").from("pagamentos").insert({
    cd_orcamento: cdOrcamento,
    ds_mercadopago_payment_id: String(pagamentoMp.id),
    ds_webhook_id: webhookId,
    tp_metodo: tpMetodo,
    nr_parcelas: pagamentoMp.installments ?? 1,
    vl_pagamento: pagamentoMp.transaction_amount,
    tp_status: tpStatus,
    ds_qr_code: pagamentoMp.point_of_interaction?.transaction_data?.qr_code ?? null,
    ts_confirmacao: tpStatus === "confirmado" ? new Date().toISOString() : null,
  });

  if (erroPagamento) {
    return NextResponse.json({ erro: erroPagamento.message }, { status: 500 });
  }

  if (tpStatus === "confirmado") {
    const { data: orcamentoAtualizado, error: erroOrcamento } = await supabase
      .schema("soma")
      .from("orcamentos")
      .update({ tp_status: "pago" })
      .eq("cd_orcamento", cdOrcamento)
      .eq("tp_status", "aceito") // só avança se ainda estava 'aceito'
      .select("cd_processo")
      .maybeSingle();

    if (erroOrcamento) {
      return NextResponse.json({ erro: erroOrcamento.message }, { status: 500 });
    }

    if (orcamentoAtualizado) {
      const nomeSugerido =
        [pagamentoMp.payer?.first_name, pagamentoMp.payer?.last_name].filter(Boolean).join(" ") || null;
      const emailParaVincular = pagamentoMp.metadata?.email_conta_existente || pagamentoMp.payer?.email;

      await garantirContaComprador(
        supabase,
        orcamentoAtualizado.cd_processo,
        emailParaVincular,
        nomeSugerido
      );
    }
  }

  return NextResponse.json({ ok: true });
}
