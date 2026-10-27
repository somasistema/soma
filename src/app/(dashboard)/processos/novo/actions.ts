"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import {
  anexarDocumentosDeConvites,
  anexarDocumentosRascunho,
  type DocumentoRascunho,
} from "@/lib/documentos-rascunho";
import type { LadoParte, VinculoParte } from "@/types/database";

// Documento já lido no cadastro; lado e posição vêm da parte que o carrega.
export type DocumentoDaParte = Omit<DocumentoRascunho, "lado" | "nr_ordem">;

export interface ParteInput {
  tp_lado: LadoParte;
  nr_ordem: number;
  nm_parte: string;
  ds_telefone: string;
  ds_email: string;
  ds_profissao: string;
  ds_conta_bancaria: string;
  ds_documentos_obs: string;
  ds_cpf: string;
  ds_rg: string;
  dt_nascimento: string; // yyyy-mm-dd
  ds_endereco: string;
  // 2ª pessoa em diante: vínculo com a anterior do mesmo lado
  tp_vinculo: VinculoParte | "";
  // Empresa (CNPJ no campo ds_cpf)
  ds_nire: string;
  ds_tipo_societario: string;
  ds_representacao: "conjunta" | "isolada" | "";
  docs?: DocumentoDaParte[];
  // Só na tela: como a pessoa é cadastrada (não vai pro banco)
  modo?: "manual" | "link";
  // Link pro cliente: token gerado na tela (vai pro banco)
  cd_token_parte?: string;
  // Só na edição: a parte já existe no processo (upsert, não recria)
  cd_parte?: string;
}

// cd_corretor vazio = corretor novo, entra no cadastro ao salvar
// (fn_salvar_dados_negocio). Os dados de CPF/CRECI/PIX/contato só são
// usados pra cadastrar — corretor já cadastrado não é sobrescrito.
export interface CorretorInput {
  cd_corretor: string;
  nm_corretor: string;
  vl_honorario: string;
  pc_honorario: string; // % do total dos honorários
  ds_lado: string;
  ds_cpf: string;
  ds_creci: string;
  ds_pix: string;
  ds_telefone: string;
  ds_email: string;
  dt_nascimento: string; // yyyy-mm-dd
}

export interface NegocioInput {
  vl_imovel: string;
  vl_entrada: string;
  vl_financiamento: string;
  ds_banco: string;
  sn_possui_inquilino: string; // "true" | "false" | ""
  sn_ocupado: string;
  ds_entrega_chaves: string;
  ds_itens_imovel: string;
  ds_imovel_endereco: string;
  ds_imovel_matricula: string;
  ds_imovel_iptu: string;
  ds_imovel_cartorio: string;
  ds_imovel_descricao: string;
  tp_pagamento: "financiado" | "a_vista" | "";
  vl_sinal: string;
  sn_usa_fgts: string; // "true" | "false" | ""
  vl_fgts: string;
  vl_saldo_quitacao: string; // calculado na tela (à vista)
  vl_honorarios_total: string;
  pc_honorarios_total: string; // % do valor do imóvel
  ds_honorarios_quando: string;
  vl_honorarios_imobiliaria: string;
  pc_honorarios_imobiliaria: string; // % do total dos honorários
}

export interface CriarProcessoInput {
  cd_imobiliaria: string;
  nm_comprador_convidado: string;
  ds_telefone_comprador_convidado: string;
  negocio: NegocioInput;
  partes: ParteInput[];
  corretores: CorretorInput[];
  // Documentos do imóvel anexados no cadastro (os das pessoas vão em partes[].docs)
  documentos_imovel?: DocumentoDaParte[];
}

export type CriarProcessoState = { erro: string } | undefined;

// Cria o processo de contrato e grava o questionário do negócio numa
// transação só (fn_criar_processo_contrato). soma.processos e as
// tabelas de negócio só têm policy de SELECT — a escrita vai por RPC
// SECURITY DEFINER, mesma razão de fn_criar_orcamento.
export async function criarProcesso(input: CriarProcessoInput): Promise<CriarProcessoState> {
  const supabase = await createClient();

  const { data: cd_processo, error } = await supabase
    .schema("soma")
    .rpc("fn_criar_processo_contrato", {
      // Imobiliária é opcional (venda sem imobiliária).
      p_cd_imobiliaria: input.cd_imobiliaria || null,
      p_nm_comprador_convidado: input.nm_comprador_convidado,
      p_ds_telefone_comprador_convidado: input.ds_telefone_comprador_convidado,
      p_negocio: input.negocio,
      p_partes: input.partes.map((p) => {
        const resto = { ...p };
        delete resto.docs;
        delete resto.modo;
        if (p.modo !== "link") delete resto.cd_token_parte;
        return resto;
      }),
      p_corretores: input.corretores,
    });

  if (error || !cd_processo) {
    console.error("Erro ao criar processo:", error);
    return { erro: error?.message ?? "Não foi possível criar o processo." };
  }

  const documentos: DocumentoRascunho[] = [
    ...input.partes.flatMap((p) =>
      p.tp_lado === "vendedor" || p.tp_lado === "comprador"
        ? (p.docs ?? []).map((d) => ({
            ...d,
            lado: p.tp_lado as "vendedor" | "comprador",
            nr_ordem: p.nr_ordem,
          }))
        : []
    ),
    ...(input.documentos_imovel ?? []).map((d) => ({ ...d, lado: "imovel" as const, nr_ordem: 0 })),
  ];

  if (documentos.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { falhas } = await anexarDocumentosRascunho(
        cd_processo as string,
        user.id,
        documentos
      );
      // O processo já existe; falha em anexar não desfaz — fica no log
      // e a pessoa anexa de novo pela tela do processo.
      if (falhas.length > 0) console.error("[processo] anexos com falha:", falhas);
    }
  }

  // Documentos que o cliente já mandou pelo link, antes de o processo existir.
  const { falhas: falhasConvite } = await anexarDocumentosDeConvites(cd_processo as string);
  if (falhasConvite.length > 0) console.error("[processo] anexos do link com falha:", falhasConvite);

  redirect(`/processos/${cd_processo}`);
}
