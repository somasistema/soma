"use server";

import { createPublicClient } from "@/lib/supabase/public";

export type AceitarOrcamentoState = { sucesso: true } | { sucesso: false; erro: string };

// Página pública — nunca há sessão aqui, então usamos o client anon
// direto. A autorização é o próprio token (cd_token_aceite), validado
// dentro de soma.fn_aceitar_orcamento_por_token (SECURITY DEFINER).
export async function aceitarOrcamento(token: string): Promise<AceitarOrcamentoState> {
  const supabase = createPublicClient();

  const { error } = await supabase
    .schema("soma")
    .rpc("fn_aceitar_orcamento_por_token", { p_token: token });

  if (error) {
    return { sucesso: false, erro: error.message || "Não foi possível registrar o aceite." };
  }

  return { sucesso: true };
}


