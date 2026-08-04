"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ItemOrcamentoInput } from "@/app/(dashboard)/orcamentos/novo/actions";

export type CriarOrcamentoComplementarState = { erro: string } | undefined;

// tp_processo não é passado aqui — o orçamento complementar herda o
// tipo do processo já existente (fixado quando o orçamento original
// foi criado); soma.fn_criar_orcamento_complementar valida os itens
// contra ele no banco.
export async function criarOrcamentoComplementar(
  cdProcesso: string,
  nmCidade: string,
  dtValidade: string,
  itens: ItemOrcamentoInput[],
  dsInscricaoMunicipal: string,
  vlTransacao: number | null,
  vlVenal: number | null
): Promise<CriarOrcamentoComplementarState> {
  const supabase = await createClient();

  const { data: cdOrcamento, error } = await supabase
    .schema("soma")
    .rpc("fn_criar_orcamento_complementar", {
      p_cd_processo: cdProcesso,
      p_nm_cidade: nmCidade,
      p_dt_validade: dtValidade,
      p_itens: itens,
      p_ds_inscricao_municipal: dsInscricaoMunicipal || null,
      p_vl_transacao: vlTransacao,
      p_vl_venal: vlVenal,
    });

  if (error || !cdOrcamento) {
    return { erro: error?.message ?? "Não foi possível criar o orçamento complementar." };
  }

  redirect(`/orcamentos/${cdOrcamento}`);
}
