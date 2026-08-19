"use server";

import { createClient } from "@/lib/supabase/server";
import type { TipoProcesso, TipoSecaoItem, TipoServico } from "@/types/database";
import { redirect } from "next/navigation";

export interface ItemOrcamentoInput {
  cd_servico: string;
  ds_descricao: string;
  tp_servico: TipoServico;
  tp_secao: TipoSecaoItem;
  vl_unitario: number;
  nr_quantidade: number;
  // Só usado no client, pra saber quais itens recalcular quando marca
  // "primeiro imóvel/financiamento" — nunca vai pro banco (removido do
  // payload antes de chamar essa action, ver orcamento-form.tsx).
  snDescontoElegivel?: boolean;
}

export interface CriarOrcamentoInput {
  tp_processo: TipoProcesso;
  cd_imobiliaria: string;
  nm_comprador_convidado: string;
  ds_telefone_comprador_convidado: string;
  nm_cidade: string;
  dt_validade: string;
  ds_inscricao_municipal: string;
  vl_transacao: number | null;
  vl_venal: number | null;
  sn_primeiro_imovel: boolean;
  cd_corretor: string | null;
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
    p_ds_inscricao_municipal: input.ds_inscricao_municipal || null,
    p_vl_transacao: input.vl_transacao,
    p_vl_venal: input.vl_venal,
    p_sn_primeiro_imovel: input.sn_primeiro_imovel,
    p_cd_corretor: input.cd_corretor,
  });

  if (error || !cd_orcamento) {
    console.error("Erro ao criar orçamento:", error);
    return { erro: error?.message ?? "Não foi possível criar o orçamento." };
  }

  redirect(`/orcamentos/${cd_orcamento}`);
}
