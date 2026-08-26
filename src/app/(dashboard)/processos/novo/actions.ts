"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CriarProcessoInput {
  cd_imobiliaria: string;
  nm_comprador_convidado: string;
  ds_telefone_comprador_convidado: string;
  cd_vendedor: string | null;
  cd_corretor: string | null;
}

export type CriarProcessoState = { erro: string } | undefined;

// Cria o processo sozinho (fluxo de Contrato: documentação chega antes
// de qualquer orçamento existir) via soma.fn_criar_processo — mesma
// razão de fn_criar_orcamento ser RPC: soma.processos só tem policy de
// SELECT, insert direto pelo client sempre seria barrado pelo RLS.
export async function criarProcesso(input: CriarProcessoInput): Promise<CriarProcessoState> {
  const supabase = await createClient();

  const { data: cd_processo, error } = await supabase.schema("soma").rpc("fn_criar_processo", {
    p_cd_imobiliaria: input.cd_imobiliaria,
    p_nm_comprador_convidado: input.nm_comprador_convidado,
    p_ds_telefone_comprador_convidado: input.ds_telefone_comprador_convidado,
    p_cd_vendedor: input.cd_vendedor,
    p_cd_corretor: input.cd_corretor,
  });

  if (error || !cd_processo) {
    console.error("Erro ao criar processo:", error);
    return { erro: error?.message ?? "Não foi possível criar o processo." };
  }

  redirect(`/processos/${cd_processo}`);
}
