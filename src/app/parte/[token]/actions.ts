"use server";

import { randomUUID } from "node:crypto";
import { processarOcr } from "@/lib/ocr/processar";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { ParteAutoatendimento } from "@/types/database";

export type ParteActionState = { sucesso: true } | { sucesso: false; erro: string };

// Página pública — a autorização é o token, revalidado dentro das
// funções SECURITY DEFINER.
export async function salvarMeusDados(
  token: string,
  dados: {
    nm_parte: string;
    ds_telefone: string;
    ds_email: string;
    ds_profissao: string;
    ds_conta_bancaria: string;
  }
): Promise<ParteActionState> {
  const supabase = createPublicClient();
  const { error } = await supabase.schema("soma").rpc("fn_atualizar_parte_publico", {
    p_token: token,
    p_dados: dados,
  });
  if (error) {
    return { sucesso: false, erro: error.message || "Não foi possível salvar." };
  }
  return { sucesso: true };
}

const CATEGORIAS_VALIDAS = [
  "identidade",
  "estado_civil",
  "comprovante_residencia",
  "onus_escritura",
];

export async function anexarMeuDocumento(
  token: string,
  categoria: string,
  formData: FormData
): Promise<ParteActionState> {
  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return { sucesso: false, erro: "Categoria inválida." };
  }
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) {
    return { sucesso: false, erro: "Selecione um arquivo." };
  }

  // Valida o token e descobre o processo.
  const publico = createPublicClient();
  const { data } = await publico
    .schema("soma")
    .rpc("fn_parte_por_token", { p_token: token });
  const parte = data as ParteAutoatendimento | null;
  if (!parte) {
    return { sucesso: false, erro: "Link inválido." };
  }

  // Upload + registro rodam com service_role (bucket e soma.documentos
  // são bloqueados pra anon).
  const service = createServiceRoleClient();
  const caminho = `${parte.cd_processo}/${randomUUID()}-${arquivo.name}`;

  const { error: erroUpload } = await service.storage
    .from("documentos")
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
  if (erroUpload) {
    return { sucesso: false, erro: erroUpload.message };
  }

  const { data: cdDocumento, error: erroRpc } = await service
    .schema("soma")
    .rpc("fn_registrar_documento_parte", {
      p_token: token,
      p_categoria: categoria,
      p_nm_arquivo: arquivo.name,
      p_storage_url: caminho,
    });

  if (erroRpc || !cdDocumento) {
    return { sucesso: false, erro: erroRpc?.message ?? "Não foi possível registrar o documento." };
  }

  await processarOcr(cdDocumento as string);
  return { sucesso: true };
}
