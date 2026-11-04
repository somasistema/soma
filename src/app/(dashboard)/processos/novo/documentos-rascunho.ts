"use server";

import { randomUUID } from "node:crypto";
import { getUsuarioAtual } from "@/lib/auth";
import type { DocumentoRascunho } from "@/lib/documentos-rascunho";
import { lerDocumento } from "@/lib/ocr/ler-documento";
import type { DadosImovelLidos } from "@/lib/ocr/dados-imovel";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sanitizarNomeArquivo } from "@/lib/utils";
import {
  CATEGORIA_DOC_INTAKE_LABEL,
  type CategoriaDocIntake,
} from "@/types/database";

export type LeituraRascunho =
  | {
      sucesso: true;
      caminho: string;
      nome: string;
      tipo: string;
      confianca: number;
      campos: DocumentoRascunho["campos"];
      dadosImovel: DadosImovelLidos | null;
    }
  | { sucesso: false; erro: string };

// Sobe o arquivo pra uma pasta de rascunho e devolve o que a leitura
// achou — a tela usa isso pra preencher os campos vazios. O arquivo só
// vira documento do processo quando o processo é criado
// (anexarDocumentosRascunho).
export async function lerDocumentoRascunho(formData: FormData): Promise<LeituraRascunho> {
  const usuario = await getUsuarioAtual();
  if (usuario.tp_role !== "master" && usuario.tp_role !== "juridico") {
    return { sucesso: false, erro: "Só Master ou Jurídico cria processo." };
  }

  const categoria = formData.get("categoria") as CategoriaDocIntake | null;
  const arquivo = formData.get("arquivo") as File | null;
  if (!categoria || !(categoria in CATEGORIA_DOC_INTAKE_LABEL)) {
    return { sucesso: false, erro: "Tipo de documento inválido." };
  }
  if (!arquivo || arquivo.size === 0) {
    return { sucesso: false, erro: "Selecione um arquivo." };
  }

  const service = createServiceRoleClient();
  const caminho = `rascunho/${usuario.cd_usuario}/${randomUUID()}-${sanitizarNomeArquivo(arquivo.name)}`;
  const { error: erroUpload } = await service.storage
    .from("documentos")
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
  if (erroUpload) {
    return { sucesso: false, erro: erroUpload.message };
  }

  try {
    const leitura = await lerDocumento({
      arquivo: await arquivo.arrayBuffer(),
      contentType: arquivo.type || null,
      nomeArquivo: arquivo.name,
      categoria,
      rotuloTipo: CATEGORIA_DOC_INTAKE_LABEL[categoria],
    });
    return {
      sucesso: true,
      caminho,
      nome: arquivo.name,
      tipo: leitura.tipoDetectado,
      confianca: leitura.confianca,
      campos: leitura.campos,
      dadosImovel: leitura.dadosImovel,
    };
  } catch (erro) {
    // O arquivo continua anexado; só a leitura falhou — a pessoa
    // preenche à mão e o documento segue pro processo.
    console.error("[rascunho] falha na leitura:", erro);
    return {
      sucesso: true,
      caminho,
      nome: arquivo.name,
      tipo: "outro",
      confianca: 0,
      campos: [],
      dadosImovel: null,
    };
  }
}

// ---------------------------------------------------------------------------
// PDF único com vários documentos (RG de um, RG do cônjuge, certidão, comprovante...).
// A IA separa as páginas por documento e identifica tipo e titular; cada documento sai num PDF
// próprio, é guardado em rascunho e lido como um anexo avulso. A tela distribui entre as pessoas.
// ---------------------------------------------------------------------------

export type DocumentoDoLote = {
  categoria: CategoriaDocIntake;
  titulares: string[];
  paginas: number[];
  caminho: string;
  nome: string;
  tipo: string;
  confianca: number;
  campos: DocumentoRascunho["campos"];
};

export type LeituraLote =
  | { sucesso: true; documentos: DocumentoDoLote[]; ignorados: number; totalPaginas: number }
  | { sucesso: false; erro: string };

const LIMITE_PDF_LOTE = 4.4 * 1024 * 1024; // a Vercel recusa corpo acima de ~4,5 MB

export async function lerPdfVariosDocumentos(formData: FormData): Promise<LeituraLote> {
  const usuario = await getUsuarioAtual();
  if (usuario.tp_role !== "master" && usuario.tp_role !== "juridico") {
    return { sucesso: false, erro: "Só Master ou Jurídico cria processo." };
  }

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { sucesso: false, erro: "Selecione um arquivo." };
  if (!/\.pdf$/i.test(arquivo.name) && arquivo.type !== "application/pdf") {
    return { sucesso: false, erro: "Este botão é para PDF com vários documentos. Para uma foto, use os botões de cada documento." };
  }
  if (arquivo.size > LIMITE_PDF_LOTE) {
    return { sucesso: false, erro: "PDF acima de 4 MB. Comprima o arquivo ou envie por partes." };
  }

  const { MAX_PAGINAS_LOTE, extrairPaginas, renderizarPaginas, segmentarComIA } = await import("@/lib/ocr/pdf-lote");
  const buffer = Buffer.from(await arquivo.arrayBuffer());

  let render;
  try {
    render = await renderizarPaginas(buffer);
  } catch (erro) {
    console.error("[pdf-lote] PDF ilegível:", erro);
    return { sucesso: false, erro: "Não foi possível abrir o PDF." };
  }
  if (render.total > MAX_PAGINAS_LOTE) {
    return { sucesso: false, erro: `O PDF tem ${render.total} páginas; o limite é ${MAX_PAGINAS_LOTE}. Divida o arquivo em partes.` };
  }

  const separados = await segmentarComIA(render.imagens);
  if (!separados) {
    return { sucesso: false, erro: "Não consegui separar os documentos do PDF agora. Anexe cada documento pelo botão do tipo." };
  }

  const aLer = separados.filter((d) => d.categoria !== "outro");
  const ignorados = separados.length - aLer.length;
  if (aLer.length === 0) {
    return { sucesso: false, erro: "Não reconheci documentos de identificação, estado civil ou residência neste PDF." };
  }

  const service = createServiceRoleClient();
  const base = arquivo.name.replace(/\.pdf$/i, "");

  async function lerUm(d: (typeof aLer)[number]): Promise<DocumentoDoLote> {
    const categoria = d.categoria as CategoriaDocIntake;
    const nome = `${CATEGORIA_DOC_INTAKE_LABEL[categoria]} - ${d.titulares[0] ?? base}.pdf`;
    const sub = await extrairPaginas(buffer, d.paginas);
    const caminho = `rascunho/${usuario.cd_usuario}/${randomUUID()}-${sanitizarNomeArquivo(nome)}`;
    const { error: erroUpload } = await service.storage
      .from("documentos")
      .upload(caminho, sub, { contentType: "application/pdf" });
    if (erroUpload) throw new Error(erroUpload.message);

    try {
      const sub2 = new Uint8Array(sub).buffer as ArrayBuffer;
      const leitura = await lerDocumento({
        arquivo: sub2,
        contentType: "application/pdf",
        nomeArquivo: nome,
        categoria,
        rotuloTipo: CATEGORIA_DOC_INTAKE_LABEL[categoria],
      });
      return { categoria, titulares: d.titulares, paginas: d.paginas, caminho, nome, tipo: leitura.tipoDetectado, confianca: leitura.confianca, campos: leitura.campos };
    } catch (erro) {
      // O arquivo ficou guardado; só a leitura falhou — a pessoa confere à mão.
      console.error("[pdf-lote] falha na leitura de um documento:", erro);
      return { categoria, titulares: d.titulares, paginas: d.paginas, caminho, nome, tipo: "outro", confianca: 0, campos: [] };
    }
  }

  // 3 por vez: cada leitura é OCR + IA, e a ação tem 60 s.
  const resultado: DocumentoDoLote[] = new Array(aLer.length);
  let proximo = 0;
  try {
    await Promise.all(
      Array.from({ length: Math.min(3, aLer.length) }, async () => {
        while (proximo < aLer.length) {
          const i = proximo++;
          resultado[i] = await lerUm(aLer[i]);
        }
      })
    );
  } catch (erro) {
    return { sucesso: false, erro: erro instanceof Error ? erro.message : "Falha ao guardar os documentos." };
  }

  return { sucesso: true, documentos: resultado, ignorados, totalPaginas: render.total };
}
