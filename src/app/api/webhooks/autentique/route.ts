import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getProvedorAssinatura } from "@/lib/assinatura";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// ================================================================
// Webhook da Autentique — eventos de assinatura do contrato.
//
// A Autentique não assina o payload; protegemos por um segredo na
// query (?secret=), configurado junto com a URL no painel dela.
//
// O formato exato do corpo pode variar entre tipos de evento — o
// parser abaixo é tolerante: procura o id do documento e a lista de
// assinaturas em alguns caminhos possíveis. Revisar contra um payload
// real quando a conta existir.
// ================================================================

function segredoConfere(request: NextRequest): boolean {
  const esperado = process.env.AUTENTIQUE_WEBHOOK_SECRET;
  if (!esperado) return false;
  const recebido = new URL(request.url).searchParams.get("secret") ?? "";
  if (recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

type SigBruta = {
  public_id?: string;
  email?: string;
  signed?: unknown;
  signed_at?: unknown;
  rejected?: unknown;
  rejected_at?: unknown;
  action?: { name?: string } | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extrair(body: any): { documentoId: string | null; assinaturas: SigBruta[]; tipoEvento: string } {
  const doc = body?.object?.data ?? body?.document ?? body?.data?.document ?? body?.data ?? {};
  const documentoId = doc?.id ?? body?.object?.id ?? null;
  const assinaturas: SigBruta[] =
    doc?.signatures ??
    body?.signatures ??
    (body?.event?.data ? [body.event.data] : []);
  const tipoEvento: string = body?.event?.type ?? body?.type ?? "";
  return { documentoId, assinaturas, tipoEvento };
}

// Marcadores por assinatura sempre valem. O tipo do evento só é usado
// como pista quando o payload traz UMA assinatura (evento individual) —
// senão um "signature.accepted" marcaria o documento inteiro.
function statusDaAssinatura(
  sig: SigBruta,
  tipoEvento: string,
  eventoIndividual: boolean
): "assinado" | "recusado" | null {
  if (sig.rejected || sig.rejected_at) return "recusado";
  if (sig.signed || sig.signed_at) return "assinado";

  if (!eventoIndividual) return null;
  const ev = tipoEvento.toLowerCase();
  if (ev.includes("reject") || ev.includes("refus")) return "recusado";
  if (ev.includes("sign") || ev.includes("accept")) return "assinado";
  return null;
}

export async function POST(request: NextRequest) {
  if (!segredoConfere(request)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const { documentoId, assinaturas, tipoEvento } = extrair(body);
  if (!documentoId) {
    return NextResponse.json({ ok: true, ignorado: "sem id de documento" });
  }

  const supabase = createServiceRoleClient();

  const { data: contrato } = await supabase
    .schema("soma")
    .from("contratos")
    .select("cd_contrato, cd_processo, tp_status, ds_documento_externo_id")
    .eq("ds_documento_externo_id", documentoId)
    .maybeSingle();

  if (!contrato) {
    return NextResponse.json({ ok: true, ignorado: "documento não é de um contrato SOMA" });
  }

  const { data: signatarios } = await supabase
    .schema("soma")
    .from("contrato_signatarios")
    .select("cd_signatario, ds_assinatura_externo_id, ds_email, tp_status")
    .eq("cd_contrato", contrato.cd_contrato);

  let houveRecusa = false;
  const eventoIndividual = assinaturas.length === 1;

  for (const sig of assinaturas) {
    const status = statusDaAssinatura(sig, tipoEvento, eventoIndividual);
    if (!status) continue;

    const alvo = (signatarios ?? []).find(
      (s) =>
        (sig.public_id && s.ds_assinatura_externo_id === sig.public_id) ||
        (sig.email && s.ds_email.toLowerCase() === sig.email.toLowerCase())
    );
    if (!alvo || alvo.tp_status === status) continue;

    await supabase
      .schema("soma")
      .from("contrato_signatarios")
      .update({ tp_status: status, ts_assinatura: new Date().toISOString() })
      .eq("cd_signatario", alvo.cd_signatario);

    if (status === "recusado") houveRecusa = true;
  }

  if (houveRecusa) {
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

  if (contratoAtual?.tp_status === "assinado" && !contratoAtual.ds_arquivo_assinado_url) {
    try {
      const provedor = getProvedorAssinatura();
      const pdf = provedor ? await provedor.baixarAssinado(documentoId) : null;
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
