"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface ParteInput {
  tp_lado: "vendedor" | "comprador";
  nr_ordem: number;
  nm_parte: string;
  ds_telefone: string;
  ds_email: string;
  ds_profissao: string;
  ds_conta_bancaria: string;
  ds_documentos_obs: string;
}

export interface CorretorInput {
  nm_corretor: string;
  vl_honorario: string;
  ds_lado: string;
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
  vl_honorarios_total: string;
  ds_honorarios_quando: string;
  vl_honorarios_imobiliaria: string;
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
