"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { CriarProcessoInput, CriarProcessoState } from "../../novo/actions";

// Grava a edição dos dados do processo (fn_atualizar_dados_processo,
// migration 065): atualiza as partes pelo cd_parte em vez de recriá-las,
// então documentos e links dos clientes continuam ligados.
export async function atualizarDadosProcesso(
  cdProcesso: string,
  input: CriarProcessoInput
): Promise<CriarProcessoState> {
  const supabase = await createClient();

  const { error } = await supabase.schema("soma").rpc("fn_atualizar_dados_processo", {
    p_cd_processo: cdProcesso,
    p_cd_imobiliaria: input.cd_imobiliaria || null,
    p_nm_solicitante: input.nm_comprador_convidado,
    p_ds_telefone: input.ds_telefone_comprador_convidado,
    p_negocio: input.negocio,
    p_partes: input.partes.map((p) => {
      // docs/modo só existem na tela; o link do cliente (token) já está no banco.
      const resto = { ...p };
      delete resto.docs;
      delete resto.modo;
      delete resto.cd_token_parte;
      return resto;
    }),
    p_corretores: input.corretores,
  });

  if (error) {
    console.error("Erro ao atualizar dados do processo:", error);
    return { erro: error.message };
  }

  revalidatePath(`/processos/${cdProcesso}`, "layout");
  redirect(`/processos/${cdProcesso}/partes`);
}
