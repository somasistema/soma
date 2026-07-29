"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ItemOrcamentoInput } from "@/app/(dashboard)/orcamentos/novo/actions";
import type { TipoOrcamento } from "@/types/database";

export type CriarOrcamentoComplementarState = { erro: string } | undefined;

export async function criarOrcamentoComplementar(
  cdProcesso: string,
  nmCidade: string,
  dtValidade: string,
  itens: ItemOrcamentoInput[],
  tpOrcamento: TipoOrcamento
): Promise<CriarOrcamentoComplementarState> {
  const supabase = await createClient();

  const { data: cdOrcamento, error } = await supabase
    .schema("soma")
    .rpc("fn_criar_orcamento_complementar", {
      p_cd_processo: cdProcesso,
      p_nm_cidade: nmCidade,
      p_dt_validade: dtValidade,
      p_itens: itens,
      p_tp_orcamento: tpOrcamento,
    });

  if (error || !cdOrcamento) {
    return { erro: error?.message ?? "Não foi possível criar o orçamento complementar." };
  }

  redirect(`/orcamentos/${cdOrcamento}`);
}
