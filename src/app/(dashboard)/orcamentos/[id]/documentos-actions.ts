"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processarOcr } from "@/lib/ocr/processar";
import type { StatusDocumento } from "@/types/database";

export type DocumentoActionState = { sucesso: true } | { sucesso: false; erro: string };

export async function uploadDocumento(formData: FormData): Promise<DocumentoActionState> {
  const supabase = await createClient();

  const cdProcesso = formData.get("cd_processo") as string;
  const tpPerfilAlvo = formData.get("tp_perfil_alvo") as string;
  const nmTipoDocumento = formData.get("nm_tipo_documento") as string;
  const arquivo = formData.get("arquivo") as File | null;
  // Opcionais — preenchidos quando o upload vem do checklist por parte.
  const cdParte = (formData.get("cd_parte") as string) || null;
  const tpCategoriaIntake = (formData.get("tp_categoria_intake") as string) || null;

  if (!cdProcesso || !tpPerfilAlvo || !nmTipoDocumento) {
    return { sucesso: false, erro: "Preencha o tipo de documento e o perfil alvo." };
  }

  if (!arquivo || arquivo.size === 0) {
    return { sucesso: false, erro: "Selecione um arquivo para enviar." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Sessão expirada. Faça login novamente." };
  }

  const caminho = `${cdProcesso}/${randomUUID()}-${arquivo.name}`;

  const { error: erroUpload } = await supabase.storage
    .from("documentos")
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });

  if (erroUpload) {
    return { sucesso: false, erro: erroUpload.message };
  }

  const { data: documentoCriado, error: erroInsert } = await supabase
    .schema("soma")
    .from("documentos")
    .insert({
      cd_processo: cdProcesso,
      cd_enviado_por: user.id,
      tp_perfil_alvo: tpPerfilAlvo,
      nm_tipo_documento: nmTipoDocumento,
      nm_arquivo: arquivo.name,
      ds_storage_url: caminho,
      cd_parte: cdParte,
      tp_categoria_intake: tpCategoriaIntake,
    })
    .select("cd_documento")
    .single();

  if (erroInsert || !documentoCriado) {
    return { sucesso: false, erro: erroInsert?.message ?? "Falha ao registrar o documento." };
  }

  // OCR roda logo depois do upload, no mesmo request. Nunca lança
  // (falha fica registrada em soma.documento_ocr) — não trava o envio.
  await processarOcr(documentoCriado.cd_documento);

  return { sucesso: true };
}

// Reprocessa o OCR de um documento (arquivo estava ruim, primeira
// tentativa falhou). Só quem já enxerga o documento.
export async function reprocessarOcr(cdDocumento: string): Promise<DocumentoActionState> {
  const supabase = await createClient();

  const { data: documento } = await supabase
    .schema("soma")
    .from("documentos")
    .select("cd_documento")
    .eq("cd_documento", cdDocumento)
    .maybeSingle();

  if (!documento) {
    return { sucesso: false, erro: "Documento não encontrado." };
  }

  await processarOcr(cdDocumento);
  return { sucesso: true };
}

export async function confirmarCampoOcr(
  cdCampo: string,
  dsValor: string
): Promise<DocumentoActionState> {
  const supabase = await createClient();

  const { error } = await supabase.schema("soma").rpc("fn_confirmar_campo_ocr", {
    p_cd_campo: cdCampo,
    p_ds_valor: dsValor,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/processos", "layout");
  revalidatePath("/orcamentos", "layout");
  return { sucesso: true };
}

export async function validarDocumento(
  cdDocumento: string,
  novoStatus: StatusDocumento,
  dsObservacoes: string | null
): Promise<DocumentoActionState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase
    .schema("soma")
    .from("documentos")
    .update({
      tp_status: novoStatus,
      cd_validador: user.id,
      ts_validacao: new Date().toISOString(),
      ds_observacoes: dsObservacoes,
    })
    .eq("cd_documento", cdDocumento);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}
