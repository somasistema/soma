import { createServiceRoleClient } from "@/lib/supabase/server";
import { classificarDocumento } from "./classificar";
import { extrairTexto } from "./extrair";
import { extrairCampos } from "./parsers";

const BUCKET = "documentos";

// Lê um documento com OCR e grava o resultado. Idempotente: pode ser
// chamada de novo pra reprocessar. Nunca lança — registra a falha na
// própria linha de soma.documento_ocr.
export async function processarOcr(cdDocumento: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: documento, error: erroDoc } = await supabase
    .schema("soma")
    .from("documentos")
    .select("cd_documento, ds_storage_url, nm_arquivo, nm_tipo_documento")
    .eq("cd_documento", cdDocumento)
    .maybeSingle();

  if (erroDoc || !documento) {
    console.error("[ocr] documento não encontrado:", cdDocumento, erroDoc);
    return;
  }

  await supabase
    .schema("soma")
    .from("documento_ocr")
    .upsert(
      {
        cd_documento: cdDocumento,
        tp_status: "processando",
        ds_erro: null,
        ts_processamento: null,
      },
      { onConflict: "cd_documento" }
    );

  const { data: ocrRow } = await supabase
    .schema("soma")
    .from("documento_ocr")
    .select("cd_documento_ocr")
    .eq("cd_documento", cdDocumento)
    .single();

  const cdDocumentoOcr = ocrRow?.cd_documento_ocr as string | undefined;

  try {
    const { data: blob, error: erroDownload } = await supabase.storage
      .from(BUCKET)
      .download(documento.ds_storage_url);

    if (erroDownload || !blob) {
      throw new Error(`Não foi possível baixar o arquivo: ${erroDownload?.message ?? "sem retorno"}`);
    }

    const { texto, confianca, paginas } = await extrairTexto(
      await blob.arrayBuffer(),
      blob.type || null,
      documento.nm_arquivo
    );

    if (!texto.trim()) {
      throw new Error("Nenhum texto reconhecido no documento.");
    }

    const tipoDetectado = classificarDocumento(documento.nm_tipo_documento, texto);
    const campos = extrairCampos(tipoDetectado, texto);

    await supabase
      .schema("soma")
      .from("documento_ocr")
      .update({
        tp_status: "concluido",
        tp_documento_detectado: tipoDetectado,
        ds_texto_extraido: texto,
        nr_confianca: confianca,
        nr_paginas: paginas,
        ds_erro: null,
        ts_processamento: new Date().toISOString(),
      })
      .eq("cd_documento", cdDocumento);

    if (cdDocumentoOcr) {
      await supabase
        .schema("soma")
        .from("documento_ocr_campos")
        .delete()
        .eq("cd_documento_ocr", cdDocumentoOcr)
        .eq("sn_confirmado", false);

      if (campos.length > 0) {
        await supabase
          .schema("soma")
          .from("documento_ocr_campos")
          .upsert(
            campos.map((c) => ({
              cd_documento_ocr: cdDocumentoOcr,
              nm_campo: c.nm_campo,
              ds_valor: c.ds_valor,
              nr_confianca: c.nr_confianca,
            })),
            { onConflict: "cd_documento_ocr,nm_campo", ignoreDuplicates: true }
          );
      }
    }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("[ocr] falha ao processar", cdDocumento, mensagem);
    await supabase
      .schema("soma")
      .from("documento_ocr")
      .update({
        tp_status: "falha",
        ds_erro: mensagem.slice(0, 500),
        ts_processamento: new Date().toISOString(),
      })
      .eq("cd_documento", cdDocumento);
  }
}
