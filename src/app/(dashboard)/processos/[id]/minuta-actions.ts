"use server";

import { randomUUID } from "node:crypto";
import { enviarContratoParaAssinatura } from "@/lib/assinatura/enviar";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { TipoPapelAprovacao } from "@/types/database";

export type MinutaActionState = { sucesso: true } | { sucesso: false; erro: string };

export async function enviarMinuta(formData: FormData): Promise<MinutaActionState> {
  const supabase = await createClient();

  const cdProcesso = formData.get("cd_processo") as string;
  const arquivo = formData.get("arquivo") as File | null;

  if (!cdProcesso || !arquivo || arquivo.size === 0) {
    return { sucesso: false, erro: "Selecione o arquivo da minuta." };
  }

  const caminho = `${cdProcesso}/${randomUUID()}-${arquivo.name}`;

  const { error: erroUpload } = await supabase.storage
    .from("minutas")
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });

  if (erroUpload) {
    return { sucesso: false, erro: erroUpload.message };
  }

  const { error } = await supabase.schema("soma").rpc("fn_enviar_minuta", {
    p_cd_processo: cdProcesso,
    p_ds_storage_url: caminho,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}

export async function gerarMinutaDeModelo(
  cdProcesso: string,
  cdModelo: string
): Promise<MinutaActionState> {
  if (!cdModelo) {
    return { sucesso: false, erro: "Escolha um modelo." };
  }

  const supabase = await createClient();

  const { error } = await supabase.schema("soma").rpc("fn_gerar_minuta_de_modelo", {
    p_cd_processo: cdProcesso,
    p_cd_modelo: cdModelo,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}

// Renderiza o modelo com os dados do processo SEM criar a minuta —
// pro Jurídico conferir antes de mandar pras 5 frentes.
export async function previsualizarMinutaDeModelo(
  cdProcesso: string,
  cdModelo: string
): Promise<{ sucesso: true; texto: string } | { sucesso: false; erro: string }> {
  if (!cdModelo) {
    return { sucesso: false, erro: "Escolha um modelo." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.schema("soma").rpc("fn_render_modelo_contrato", {
    p_cd_processo: cdProcesso,
    p_cd_modelo: cdModelo,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true, texto: (data as string | null) ?? "" };
}

export async function decidirMinuta(
  cdMinuta: string,
  tpPapel: TipoPapelAprovacao,
  aprovar: boolean,
  comentario: string | null
): Promise<MinutaActionState> {
  const supabase = await createClient();

  const { error } = await supabase.schema("soma").rpc("fn_decidir_minuta", {
    p_cd_minuta: cdMinuta,
    p_tp_papel: tpPapel,
    p_aprovar: aprovar,
    p_comentario: comentario,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  // Se esta foi a 5ª aprovação, fn_decidir_minuta já criou o contrato
  // final — mandamos pra assinatura na hora. Falha aqui não desfaz a
  // aprovação (fica registrada em contratos.ds_erro_envio; dá pra
  // reenviar pela tela).
  if (aprovar) {
    const { data: contrato } = await supabase
      .schema("soma")
      .from("contratos")
      .select("cd_contrato, ds_documento_externo_id")
      .eq("cd_minuta", cdMinuta)
      .maybeSingle();

    if (contrato && !contrato.ds_documento_externo_id) {
      await enviarContratoParaAssinatura(contrato.cd_contrato).catch((e) =>
        console.error("[assinatura] envio automático falhou:", e)
      );
    }
  }

  return { sucesso: true };
}

// Reenvia o contrato pra assinatura — usado quando o envio automático
// falhou (provedor fora do ar, faltava representante, token só entrou
// depois). Só Jurídico/Master.
export async function reenviarAssinatura(cdContrato: string): Promise<MinutaActionState> {
  const usuario = await getUsuarioAtual();
  if (usuario.tp_role !== "master" && usuario.tp_role !== "juridico") {
    return { sucesso: false, erro: "Só Jurídico ou Master reenvia o contrato para assinatura." };
  }

  const resultado = await enviarContratoParaAssinatura(cdContrato);
  if (resultado.naoConfigurado) {
    return { sucesso: false, erro: "Assinatura digital ainda não configurada (sem token da Autentique)." };
  }
  if (!resultado.enviado) {
    return { sucesso: false, erro: resultado.erro ?? "Não foi possível enviar." };
  }
  return { sucesso: true };
}
