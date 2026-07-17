"use server";

import { createClient } from "@/lib/supabase/server";
import type { TipoProcesso, TipoServico } from "@/types/database";
import { redirect } from "next/navigation";

export interface ItemOrcamentoInput {
  cd_servico: string;
  ds_descricao: string;
  tp_servico: TipoServico;
  vl_unitario: number;
  nr_quantidade: number;
}

export interface CriarOrcamentoInput {
  tp_processo: TipoProcesso;
  cd_imobiliaria: string;
  nm_comprador_convidado: string;
  ds_telefone_comprador_convidado: string;
  nm_cidade: string;
  dt_validade: string;
  itens: ItemOrcamentoInput[];
}

export type CriarOrcamentoState = { erro: string } | undefined;

// Criação atômica (processo + orçamento + itens) via soma.fn_criar_orcamento —
// necessário porque soma.processos só tem policy de SELECT: um insert direto
// nessa tabela pelo client sempre seria barrado pelo RLS.
export async function criarOrcamento(
  input: CriarOrcamentoInput
): Promise<CriarOrcamentoState> {
  const supabase = await createClient();

  const { data: cd_orcamento, error } = await supabase.schema("soma").rpc("fn_criar_orcamento", {
    p_tp_processo: input.tp_processo,
    p_cd_imobiliaria: input.cd_imobiliaria,
    p_nm_comprador_convidado: input.nm_comprador_convidado,
    p_ds_telefone_comprador_convidado: input.ds_telefone_comprador_convidado,
    p_nm_cidade: input.nm_cidade,
    p_dt_validade: input.dt_validade,
    p_itens: input.itens,
  });

  if (error || !cd_orcamento) {
    console.error("Erro ao criar orçamento:", error);
    return { erro: error?.message ?? "Não foi possível criar o orçamento." };
  }

  redirect(`/orcamentos/${cd_orcamento}`);
}
