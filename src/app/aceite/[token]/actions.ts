"use server";

import { createPublicClient } from "@/lib/supabase/public";

export type AceitarOrcamentoState = { sucesso: true } | { sucesso: false; erro: string };

// Página pública — nunca há sessão aqui, então usamos o client anon
// direto. A autorização é o próprio token (cd_token_aceite), validado
// dentro de soma.fn_aceitar_orcamento_por_token (SECURITY DEFINER).
// A função também exige p_termo_aceito = true e ao menos um item em
// p_itens_selecionados — validado de novo lá dentro, então o client
// não é a única barreira.
export async function aceitarOrcamento(
  token: string,
  itensSelecionados: string[],
  termoAceito: boolean
): Promise<AceitarOrcamentoState> {
  const supabase = createPublicClient();

  const { error } = await supabase.schema("soma").rpc("fn_aceitar_orcamento_por_token", {
    p_token: token,
    p_itens_selecionados: itensSelecionados,
    p_termo_aceito: termoAceito,
  });

  if (error) {
    return { sucesso: false, erro: error.message || "Não foi possível registrar o aceite." };
  }

  return { sucesso: true };
}
