"use server";

import { enviarContratoParaAssinatura } from "@/lib/assinatura/enviar";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type DecisaoLinkState = { sucesso: true } | { sucesso: false; erro: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Aceitar/recusar a minuta pelo link do e-mail (sem login). A regra toda
// mora na função do banco; aqui só chamamos e, se esta foi a última
// aprovação (contrato final gerado), mandamos o contrato pra assinatura.
export async function decidirPeloLink(
  token: string,
  aprovar: boolean,
  comentario: string
): Promise<DecisaoLinkState> {
  if (!UUID.test(token)) return { sucesso: false, erro: "Link inválido." };
  if (!aprovar && comentario.trim() === "") {
    return { sucesso: false, erro: "Conte o motivo da recusa." };
  }

  const supabase = createPublicClient();
  const { error } = await supabase.schema("soma").rpc("fn_decidir_minuta_convite", {
    p_token: token,
    p_aprovar: aprovar,
    p_comentario: comentario.trim() || null,
  });
  if (error) return { sucesso: false, erro: error.message };

  if (aprovar) {
    const admin = createServiceRoleClient();
    const { data: convite } = await admin
      .schema("soma")
      .from("minuta_convites")
      .select("cd_minuta")
      .eq("cd_convite", token)
      .maybeSingle();
    if (convite) {
      const { data: contrato } = await admin
        .schema("soma")
        .from("contratos")
        .select("cd_contrato, ds_documento_externo_id")
        .eq("cd_minuta", convite.cd_minuta)
        .maybeSingle();
      // Falha no envio não desfaz a aprovação: fica em contratos.ds_erro_envio
      // e dá pra reenviar pela tela do processo.
      if (contrato && !contrato.ds_documento_externo_id) {
        await enviarContratoParaAssinatura(contrato.cd_contrato).catch((e) =>
          console.error("[assinatura] envio automático falhou:", e)
        );
      }
    }
  }

  return { sucesso: true };
}
