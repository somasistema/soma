"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import type { LadoParte } from "@/types/database";

export interface ParteInput {
  tp_lado: LadoParte;
  nr_ordem: number;
  nm_parte: string;
  ds_telefone: string;
  ds_email: string;
  ds_profissao: string;
  ds_conta_bancaria: string;
  ds_documentos_obs: string;
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
      p_cd_imobiliaria: input.cd_imobiliaria,
      p_nm_comprador_convidado: input.nm_comprador_convidado,
      p_ds_telefone_comprador_convidado: input.ds_telefone_comprador_convidado,
      p_negocio: input.negocio,
      p_partes: input.partes,
      p_corretores: input.corretores,
    });

  if (error || !cd_processo) {
    console.error("Erro ao criar processo:", error);
    return { erro: error?.message ?? "Não foi possível criar o processo." };
  }

  redirect(`/processos/${cd_processo}`);
}
