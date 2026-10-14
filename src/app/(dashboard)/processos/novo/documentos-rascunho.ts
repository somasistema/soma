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
