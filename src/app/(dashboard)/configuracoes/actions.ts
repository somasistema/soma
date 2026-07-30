"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BlocoFluxo, TipoAplicavelFluxo } from "@/types/database";

export async function atualizarPosicaoBloco(cd_bloco: BlocoFluxo, x: number, y: number) {
  const supabase = await createClient();

  await supabase
    .schema("soma")
    .from("fluxo_blocos")
    .update({ posicao_x: x, posicao_y: y })
    .eq("cd_bloco", cd_bloco);

  revalidatePath("/configuracoes/fluxo");
}

export async function alternarAtivoBloco(cd_bloco: BlocoFluxo, sn_ativo: boolean) {
  const supabase = await createClient();

  await supabase.schema("soma").from("fluxo_blocos").update({ sn_ativo }).eq("cd_bloco", cd_bloco);

  // O formulário de novo orçamento lê esses blocos direto do banco a
  // cada carregamento — precisa invalidar essa rota também, não só a
  // do editor.
  revalidatePath("/configuracoes/fluxo");
  revalidatePath("/orcamentos/novo");
}

export async function atualizarAplicavelBloco(cd_bloco: BlocoFluxo, tp_aplicavel: TipoAplicavelFluxo) {
  const supabase = await createClient();

  await supabase
    .schema("soma")
    .from("fluxo_blocos")
    .update({ tp_aplicavel })
    .eq("cd_bloco", cd_bloco);

  revalidatePath("/configuracoes/fluxo");
  revalidatePath("/orcamentos/novo");
}
