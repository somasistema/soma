"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CidadeState = { erro?: string } | null;

export async function criarCidade(_prevState: CidadeState, formData: FormData): Promise<CidadeState> {
  const nmCidade = String(formData.get("nm_cidade") ?? "").trim();

  if (nmCidade.length < 2) {
    return { erro: "Informe o nome da cidade." };
  }

  const supabase = await createClient();

  const { data: ultima } = await supabase
    .schema("soma")
    .from("cidades")
    .select("nr_ordem")
    .order("nr_ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .schema("soma")
    .from("cidades")
    .insert({ nm_cidade: nmCidade, nr_ordem: (ultima?.nr_ordem ?? 0) + 10 });

  if (error) {
    return {
      erro: error.code === "23505" ? "Essa cidade já está cadastrada." : "Não foi possível salvar.",
    };
  }

  revalidatePath("/configuracoes/cidades", "layout");
  revalidatePath("/orcamentos/novo");
  revalidatePath("/servicos", "layout");
  return null;
}

export async function alternarAtivoCidade(cd_cidade: string, sn_ativo: boolean) {
  const supabase = await createClient();

  await supabase.schema("soma").from("cidades").update({ sn_ativo }).eq("cd_cidade", cd_cidade);

  revalidatePath("/configuracoes/cidades", "layout");
  revalidatePath("/orcamentos/novo");
  revalidatePath("/servicos", "layout");
}

export async function excluirCidade(cd_cidade: string): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.schema("soma").from("cidades").delete().eq("cd_cidade", cd_cidade);

  if (error) {
    return { erro: "Não foi possível excluir a cidade." };
  }

  revalidatePath("/configuracoes/cidades", "layout");
  revalidatePath("/orcamentos/novo");
  revalidatePath("/servicos", "layout");
  return {};
}
