"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ItemOrcamentoInput } from "@/app/(dashboard)/orcamentos/novo/actions";

export type AtualizarOrcamentoState = { erro: string } | undefined;

export async function atualizarOrcamento(
  cdOrcamento: string,
  nmCidade: string,
  dtValidade: string,
  itens: ItemOrcamentoInput[],
  dsInscricaoMunicipal: string,
  vlTransacao: number | null,
  vlVenal: number | null
): Promise<AtualizarOrcamentoState> {
  const supabase = await createClient();

  const { data: cdOrcamentoAtualizado, error } = await supabase
    .schema("soma")
    .rpc("fn_atualizar_orcamento", {
      p_cd_orcamento: cdOrcamento,
      p_nm_cidade: nmCidade,
      p_dt_validade: dtValidade,
      p_itens: itens,
      p_ds_inscricao_municipal: dsInscricaoMunicipal || null,
      p_vl_transacao: vlTransacao,
      p_vl_venal: vlVenal,
    });

  if (error || !cdOrcamentoAtualizado) {
    return { erro: error?.message ?? "Não foi possível salvar as alterações." };
  }

  redirect(`/orcamentos/${cdOrcamentoAtualizado}`);
}
