import { createServiceRoleClient } from "@/lib/supabase/server";
import { classificarDocumento } from "./classificar";
import { extrairTexto } from "./extrair";
import { extrairCampos, type CampoLido } from "./parsers";
import { lerDocumentoComIA, validarOcrComIA } from "./validar-ia";

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

    const { texto, confianca, paginas, imagemPrincipal } = await extrairTexto(
      await blob.arrayBuffer(),
      blob.type || null,
      documento.nm_arquivo
    );

    if (!texto.trim()) {
      throw new Error("Nenhum texto reconhecido no documento.");
    }

    const tipoDetectado = classificarDocumento(documento.nm_tipo_documento, texto);
    let campos: CampoLido[] = extrairCampos(tipoDetectado, texto);

    // Resgate por IA: o Tesseract às vezes não acha NENHUM campo (ex:
    // documento com fundo de segurança/textura forte — certidão,
    // plástico etc.). Em vez de deixar o documento sem nenhum dado, a
    // IA lê a imagem do zero. Só roda quando o regex falhou de vez —
    // se achou algo, segue pra conferência normal (mais abaixo).
    let tipoSugeridoIA: string | null = null;
    if (campos.length === 0 && imagemPrincipal) {
      const leitura = await lerDocumentoComIA({
        imagem: imagemPrincipal.dados,
        mimeType: imagemPrincipal.mimeType,
      });
      if (leitura && leitura.campos.length > 0) {
        campos = leitura.campos.map((c) => ({
          nm_campo: c.nm_campo,
          ds_valor: c.ds_valor,
          nr_confianca: c.confianca,
        }));
        tipoSugeridoIA = leitura.tipoDetectado;
      }
    }

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
        ...(tipoSugeridoIA
          ? { sn_tipo_confere_ia: false, tp_documento_sugerido_ia: tipoSugeridoIA, ts_validacao_ia: new Date().toISOString() }
          : {}),
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

        // Conferência por IA — opcional (só com ANTHROPIC_API_KEY e
        // quando temos uma imagem da página, não em PDF de texto puro).
        // Pula quando os campos já vieram da leitura de resgate da IA —
        // conferir a própria resposta não agrega nada.
        if (imagemPrincipal && !tipoSugeridoIA) {
          const validacao = await validarOcrComIA({
            imagem: imagemPrincipal.dados,
            mimeType: imagemPrincipal.mimeType,
            tipoDetectado,
            campos,
          });

          if (validacao) {
            await supabase
              .schema("soma")
              .from("documento_ocr")
              .update({
                sn_tipo_confere_ia: validacao.tipoConfere,
                tp_documento_sugerido_ia: validacao.tipoSugerido,
                ts_validacao_ia: new Date().toISOString(),
              })
              .eq("cd_documento", cdDocumento);

            await Promise.all(
              validacao.campos.map((c) =>
                supabase
                  .schema("soma")
                  .from("documento_ocr_campos")
                  .update({
                    sn_confere_ia: c.confere,
                    ds_valor_sugerido_ia: c.valorSugerido,
                    nr_confianca_ia: c.confianca,
                  })
                  .eq("cd_documento_ocr", cdDocumentoOcr)
                  .eq("nm_campo", c.nm_campo)
              )
            );
          }
        }
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
