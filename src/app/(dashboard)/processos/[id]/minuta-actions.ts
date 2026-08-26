"use server";

import { randomUUID } from "node:crypto";
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

  return { sucesso: true };
}
