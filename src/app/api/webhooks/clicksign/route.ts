import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getProvedorAssinatura } from "@/lib/assinatura";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ================================================================
// Webhook da Clicksign — eventos de assinatura do contrato.
//
// Autenticação: a Clicksign assina o corpo com HMAC SHA256 no header
// "Content-Hmac" (valor "sha256=<hex>"), usando o segredo gerado quando
// o webhook é cadastrado (CLICKSIGN_WEBHOOK_SECRET). O cálculo é sobre
// o corpo CRU, sem reformatar o JSON.
//
// Cadastro (painel ou POST /api/v3/webhooks): endpoint
//   https://<site>/api/webhooks/clicksign
// com os eventos: sign, refusal, document_closed, auto_close, close,
// cancel.
//
// Formato do payload (doc da Clicksign): { event: { name, data: {
// signer: { key, email, name } } }, document: { key, ... } }. O envelope
// não vem no payload — por isso contratos.ds_documento_externo_id
// guarda "<envelope>:<documento>" e aqui casamos pela chave do documento.
// ================================================================

function assinaturaConfere(corpoCru: string, header: string | null): boolean {
  const segredo = process.env.CLICKSIGN_WEBHOOK_SECRET;
  if (!segredo || !header) return false;

  const esperado = createHmac("sha256", segredo).update(corpoCru).digest("hex");
  const recebido = header.trim().replace(/^sha256=/i, "").toLowerCase();
  if (recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

type Payload = {
  event?: {
    name?: string;
    data?: { signer?: { key?: string; email?: string } };
  };
  document?: { key?: string };
};

const EVENTOS_DE_FECHAMENTO = new Set(["document_closed", "auto_close", "close"]);

export async function POST(request: NextRequest) {
  const corpoCru = await request.text();

  if (!assinaturaConfere(corpoCru, request.headers.get("content-hmac"))) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = JSON.parse(corpoCru) as Payload;
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const evento = payload.event?.name ?? "";
  const chaveDocumento = payload.document?.key ?? "";
  // A chave entra num LIKE: só aceita formato de UUID.
  if (!/^[0-9a-f-]{36}$/i.test(chaveDocumento)) {
    return NextResponse.json({ ok: true, ignorado: "sem chave de documento" });
  }

  const supabase = createServiceRoleClient();

  const { data: contrato } = await supabase
    .schema("soma")
    .from("contratos")
    .select("cd_contrato, cd_processo, tp_status, ds_documento_externo_id")
    .like("ds_documento_externo_id", `%:${chaveDocumento}`)
    .maybeSingle();

  if (!contrato) {
    return NextResponse.json({ ok: true, ignorado: "documento não é de um contrato SOMA" });
  }

  // ---- cancelado no provedor ----------------------------------------
  if (evento === "cancel") {
    await supabase
      .schema("soma")
      .from("contratos")
      .update({ tp_status: "cancelado" })
      .eq("cd_contrato", contrato.cd_contrato)
      .neq("tp_status", "assinado");
    await supabase.schema("soma").rpc("fn_registrar_andamento", {
      p_cd_processo: contrato.cd_processo,
      p_nm_etapa: "Assinatura cancelada",
      p_ds_andamento: "O envio do contrato para assinatura foi cancelado na Clicksign.",
    });
    return NextResponse.json({ ok: true, cancelado: true });
  }

  // ---- assinou / recusou ----------------------------------------------
  if (evento === "sign" || evento === "refusal") {
    const signer = payload.event?.data?.signer;

    const { data: signatarios } = await supabase
      .schema("soma")
      .from("contrato_signatarios")
      .select("cd_signatario, ds_assinatura_externo_id, ds_email, tp_status")
      .eq("cd_contrato", contrato.cd_contrato);

    const alvo = (signatarios ?? []).find(
      (s) =>
        (signer?.key && s.ds_assinatura_externo_id === signer.key) ||
        (signer?.email && s.ds_email.toLowerCase() === signer.email.toLowerCase())
    );

    if (evento === "refusal") {
      if (alvo) {
        await supabase
          .schema("soma")
          .from("contrato_signatarios")
          .update({ tp_status: "recusado", ts_assinatura: new Date().toISOString() })
          .eq("cd_signatario", alvo.cd_signatario);
      }
      await supabase
        .schema("soma")
        .from("contratos")
        .update({ tp_status: "recusado" })
        .eq("cd_contrato", contrato.cd_contrato)
        .neq("tp_status", "assinado");
      await supabase.schema("soma").rpc("fn_registrar_andamento", {
        p_cd_processo: contrato.cd_processo,
        p_nm_etapa: "Assinatura recusada",
        p_ds_andamento: "Uma das frentes recusou a assinatura do contrato.",
      });
      return NextResponse.json({ ok: true, recusado: true });
    }

    if (alvo && alvo.tp_status !== "assinado") {
      await supabase
        .schema("soma")
        .from("contrato_signatarios")
        .update({ tp_status: "assinado", ts_assinatura: new Date().toISOString() })
        .eq("cd_signatario", alvo.cd_signatario);
    }
  } else if (!EVENTOS_DE_FECHAMENTO.has(evento)) {
    return NextResponse.json({ ok: true, ignorado: `evento ${evento || "(sem nome)"}` });
  }

  // Fecha o contrato se todas as frentes já assinaram.
  await supabase.schema("soma").rpc("fn_concluir_assinatura_contrato", {
    p_cd_contrato: contrato.cd_contrato,
  });

  const { data: contratoAtual } = await supabase
    .schema("soma")
    .from("contratos")
    .select("tp_status, ds_arquivo_assinado_url")
    .eq("cd_contrato", contrato.cd_contrato)
    .maybeSingle();

  // O PDF assinado só existe depois que a Clicksign finaliza o documento;
  // se ainda não estiver pronto agora, o evento de fechamento tenta de novo.
  if (contratoAtual?.tp_status === "assinado" && !contratoAtual.ds_arquivo_assinado_url) {
    try {
      const provedor = getProvedorAssinatura();
      const pdf =
        provedor && contrato.ds_documento_externo_id
          ? await provedor.baixarAssinado(contrato.ds_documento_externo_id)
          : null;
      if (pdf) {
        const caminho = `${contrato.cd_processo}/contrato-assinado-${contrato.cd_contrato}.pdf`;
        await supabase.storage
          .from("minutas")
          .upload(caminho, pdf, { contentType: "application/pdf", upsert: true });
        await supabase
          .schema("soma")
          .from("contratos")
          .update({ ds_arquivo_assinado_url: caminho })
          .eq("cd_contrato", contrato.cd_contrato);
      }
    } catch (erro) {
      console.error("[assinatura] falha ao baixar PDF assinado:", erro);
    }
  }

  return NextResponse.json({ ok: true });
}
