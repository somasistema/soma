import { randomUUID } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { CATEGORIAS_DOC_IMOVEL, CATEGORIA_DOC_INTAKE_LABEL, type CategoriaDocIntake } from "@/types/database";

// Documento anexado no cadastro do processo, antes de ele existir.
// O arquivo fica em rascunho/<usuario>/... até o processo ser criado.
export type DocumentoRascunho = {
  // "vendedor" | "comprador" | "imovel" + posição na lista (nr_ordem)
  lado: "vendedor" | "comprador" | "imovel";
  nr_ordem: number;
  categoria: CategoriaDocIntake;
  caminho: string;
  nome: string;
  tipo: string | null;
  confianca: number | null;
  campos: { nm_campo: string; ds_valor: string; nr_confianca: number | null }[];
};

const TIPOS_OCR = [
  "rg",
  "cpf",
  "cnh",
  "comprovante_residencia",
  "matricula_imovel",
  "certidao",
  "contrato_social",
  "outro",
];

const BUCKET = "documentos";

// Move os arquivos do rascunho pro processo recém-criado, registra os
// documentos (já validados, vinculados à parte e ao item do checklist)
// e grava o resultado da leitura. Roda com service_role; só aceita
// arquivos que estejam na pasta de rascunho DO PRÓPRIO usuário.
export async function anexarDocumentosRascunho(
  cdProcesso: string,
  cdUsuario: string,
  documentos: DocumentoRascunho[]
): Promise<{ anexados: number; falhas: string[] }> {
  const supabase = createServiceRoleClient();
  const falhas: string[] = [];
  let anexados = 0;

  const { data: partes } = await supabase
    .schema("soma")
    .from("processo_parte")
    .select("cd_parte, tp_lado, nr_ordem")
    .eq("cd_processo", cdProcesso);

  for (const doc of documentos) {
    try {
      if (!doc.caminho.startsWith(`rascunho/${cdUsuario}/`) || doc.caminho.includes("..")) {
        throw new Error("arquivo fora da pasta do usuário");
      }
      if (!(doc.categoria in CATEGORIA_DOC_INTAKE_LABEL)) throw new Error("categoria inválida");

      const doImovel = CATEGORIAS_DOC_IMOVEL.includes(doc.categoria);
      let cdParte: string | null = null;
      if (!doImovel) {
        cdParte =
          partes?.find((p) => p.tp_lado === doc.lado && p.nr_ordem === doc.nr_ordem)?.cd_parte ?? null;
        if (!cdParte) throw new Error("pessoa não encontrada (nome em branco?)");
      }

      const novoCaminho = `${cdProcesso}/${randomUUID()}-${doc.caminho.split("/").pop()}`;
      const { error: erroMover } = await supabase.storage.from(BUCKET).move(doc.caminho, novoCaminho);
      if (erroMover) throw new Error(erroMover.message);

      const { data: criado, error: erroDoc } = await supabase
        .schema("soma")
        .from("documentos")
        .insert({
          cd_processo: cdProcesso,
          cd_enviado_por: cdUsuario,
          tp_perfil_alvo: doImovel ? "imovel" : doc.lado,
          nm_tipo_documento: CATEGORIA_DOC_INTAKE_LABEL[doc.categoria],
          nm_arquivo: doc.nome,
          ds_storage_url: novoCaminho,
          cd_parte: cdParte,
          tp_categoria_intake: doc.categoria,
        })
        .select("cd_documento")
        .single();
      if (erroDoc || !criado) throw new Error(erroDoc?.message ?? "falha ao registrar");

      const { data: ocr } = await supabase
        .schema("soma")
        .from("documento_ocr")
        .upsert(
          {
            cd_documento: criado.cd_documento,
            tp_status: "concluido",
            tp_documento_detectado: TIPOS_OCR.includes(doc.tipo ?? "") ? doc.tipo : "outro",
            nr_confianca: doc.confianca,
            ts_processamento: new Date().toISOString(),
            ts_validacao_ia: new Date().toISOString(),
          },
          { onConflict: "cd_documento" }
        )
        .select("cd_documento_ocr")
        .single();

      if (ocr && doc.campos.length > 0) {
        await supabase
          .schema("soma")
          .from("documento_ocr_campos")
          .upsert(
            doc.campos.map((c) => ({
              cd_documento_ocr: ocr.cd_documento_ocr,
              nm_campo: c.nm_campo.slice(0, 40),
              ds_valor: c.ds_valor,
              nr_confianca: c.nr_confianca,
            })),
            { onConflict: "cd_documento_ocr,nm_campo", ignoreDuplicates: true }
          );
      }
      anexados++;
    } catch (erro) {
      falhas.push(`${doc.nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }

  return { anexados, falhas };
}

// Grava o resultado da leitura (documento_ocr + campos) sem reprocessar.
async function gravarLeitura(
  supabase: ReturnType<typeof createServiceRoleClient>,
  cdDocumento: string,
  tipo: string | null,
  confianca: number | null,
  campos: { nm_campo: string; ds_valor: string; nr_confianca?: number | null }[]
) {
  const { data: ocr } = await supabase
    .schema("soma")
    .from("documento_ocr")
    .upsert(
      {
        cd_documento: cdDocumento,
        tp_status: "concluido",
        tp_documento_detectado: TIPOS_OCR.includes(tipo ?? "") ? tipo : "outro",
        nr_confianca: confianca,
        ts_processamento: new Date().toISOString(),
        ts_validacao_ia: new Date().toISOString(),
      },
      { onConflict: "cd_documento" }
    )
    .select("cd_documento_ocr")
    .single();

  if (ocr && campos.length > 0) {
    await supabase
      .schema("soma")
      .from("documento_ocr_campos")
      .upsert(
        campos.map((c) => ({
          cd_documento_ocr: ocr.cd_documento_ocr,
          nm_campo: c.nm_campo.slice(0, 40),
          ds_valor: c.ds_valor,
          nr_confianca: c.nr_confianca ?? null,
        })),
        { onConflict: "cd_documento_ocr,nm_campo", ignoreDuplicates: true }
      );
  }
}

// Documentos que o cliente anexou pelo link ANTES do processo existir
// (soma.convite_documentos): move o arquivo pra pasta do processo e
// registra como documento da parte, já com a leitura. Roda logo depois
// de o processo ser criado (o banco já mesclou os dados do convite).
export async function anexarDocumentosDeConvites(
  cdProcesso: string
): Promise<{ anexados: number; falhas: string[] }> {
  const supabase = createServiceRoleClient();
  const falhas: string[] = [];
  let anexados = 0;

  const { data: partes } = await supabase
    .schema("soma")
    .from("processo_parte")
    .select("cd_parte, tp_lado, cd_token_parte")
    .eq("cd_processo", cdProcesso);

  const tokens = (partes ?? []).map((p) => p.cd_token_parte).filter(Boolean) as string[];
  if (tokens.length === 0) return { anexados, falhas };

  const { data: docs } = await supabase
    .schema("soma")
    .from("convite_documentos")
    .select("*")
    .in("cd_convite", tokens)
    .is("cd_documento", null)
    .order("ts_criacao");

  for (const doc of docs ?? []) {
    try {
      const parte = partes?.find((p) => p.cd_token_parte === doc.cd_convite);
      if (!parte) throw new Error("parte não encontrada");

      const novoCaminho = `${cdProcesso}/${randomUUID()}-${String(doc.ds_storage_url).split("/").pop()}`;
      const { error: erroMover } = await supabase.storage
        .from(BUCKET)
        .move(doc.ds_storage_url, novoCaminho);
      if (erroMover) throw new Error(erroMover.message);

      const { data: criado, error: erroDoc } = await supabase
        .schema("soma")
        .from("documentos")
        .insert({
          cd_processo: cdProcesso,
          tp_perfil_alvo: parte.tp_lado === "vendedor" || parte.tp_lado === "comprador" ? parte.tp_lado : "outro",
          nm_tipo_documento: CATEGORIA_DOC_INTAKE_LABEL[doc.tp_categoria_intake as CategoriaDocIntake],
          nm_arquivo: doc.nm_arquivo,
          ds_storage_url: novoCaminho,
          cd_parte: parte.cd_parte,
          tp_categoria_intake: doc.tp_categoria_intake,
        })
        .select("cd_documento")
        .single();
      if (erroDoc || !criado) throw new Error(erroDoc?.message ?? "falha ao registrar");

      await gravarLeitura(
        supabase,
        criado.cd_documento,
        doc.tp_documento_detectado,
        doc.nr_confianca,
        (doc.ds_campos ?? []) as { nm_campo: string; ds_valor: string; nr_confianca?: number | null }[]
      );

      await supabase
        .schema("soma")
        .from("convite_documentos")
        .update({ cd_documento: criado.cd_documento, ds_storage_url: novoCaminho })
        .eq("cd_convite_documento", doc.cd_convite_documento);
      anexados++;
    } catch (erro) {
      falhas.push(`${doc.nm_arquivo}: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  }

  return { anexados, falhas };
}
