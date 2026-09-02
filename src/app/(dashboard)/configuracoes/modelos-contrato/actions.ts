"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ModeloState = { erro?: string } | null;

type SalvarInput = {
  cd_modelo: string | null;
  nm_modelo: string;
  ds_descricao: string;
  ds_conteudo: string;
};

export async function salvarModelo(input: SalvarInput): Promise<ModeloState> {
  const nm = input.nm_modelo.trim();
  const conteudo = input.ds_conteudo.trim();

  if (nm.length < 2) return { erro: "Informe o nome do modelo." };
  if (conteudo.length < 10) return { erro: "O modelo está muito curto." };

  const supabase = await createClient();

  const { error } = await supabase.schema("soma").rpc("fn_salvar_modelo_contrato", {
    p_cd_modelo: input.cd_modelo,
    p_nm_modelo: nm,
    p_ds_descricao: input.ds_descricao.trim() || null,
    p_ds_conteudo: input.ds_conteudo,
  });

  if (error) return { erro: error.message };

  revalidatePath("/configuracoes/modelos-contrato");
  return null;
}

export async function alternarAtivoModelo(cd_modelo: string, sn_ativo: boolean) {
  const supabase = await createClient();
  await supabase.schema("soma").rpc("fn_arquivar_modelo_contrato", {
    p_cd_modelo: cd_modelo,
    p_sn_ativo: sn_ativo,
  });
  revalidatePath("/configuracoes/modelos-contrato");
}

export async function excluirModelo(cd_modelo: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.schema("soma").rpc("fn_excluir_modelo_contrato", {
    p_cd_modelo: cd_modelo,
  });
  if (error) return { erro: error.message };
  revalidatePath("/configuracoes/modelos-contrato");
  return {};
}
