"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PacoteState = { erro?: string } | null;

export async function criarPacoteItem(
  _prevState: PacoteState,
  formData: FormData
): Promise<PacoteState> {
  const cdServico = String(formData.get("cd_servico") ?? "");
  const cdCusta = String(formData.get("cd_custa") ?? "");
  const snOpcional = formData.get("sn_opcional") === "on";

  if (!cdServico || !cdCusta) {
    return { erro: "Escolha o serviço e o boleto." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .schema("soma")
    .from("pacote_itens")
    .insert({ cd_servico: cdServico, cd_custa: cdCusta, sn_opcional: snOpcional });

  if (error) {
    return {
      erro: error.code === "23505" ? "Esse boleto já está vinculado a esse serviço." : "Não foi possível salvar.",
    };
  }

  revalidatePath("/configuracoes/pacotes");
  return null;
}

export async function excluirPacoteItem(cd_pacote_item: string): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .schema("soma")
    .from("pacote_itens")
    .delete()
    .eq("cd_pacote_item", cd_pacote_item);

  if (error) {
    return { erro: "Não foi possível remover." };
  }

  revalidatePath("/configuracoes/pacotes");
  return {};
}
