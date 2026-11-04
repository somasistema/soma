"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Imobiliaria } from "@/types/database";

export interface ImobiliariaDados {
  cd_imobiliaria: string | null;
  nm_imobiliaria: string;
  ds_cnpj: string;
  ds_creci: string;
  ds_endereco: string;
  ds_telefone: string;
  ds_email: string;
  // Aparece na qualificação do contrato (corretagem). Desmarcado = a própria SOMA.
  sn_qualifica_contrato: boolean;
}

const vazioParaNull = (s: string) => (s.trim() === "" ? null : s.trim());

function revalidar() {
  revalidatePath("/configuracoes/imobiliarias");
  revalidatePath("/processos/novo");
  revalidatePath("/orcamentos/novo");
}

// RLS de soma.imobiliarias (migration 002): só Master e Jurídico gravam.
export async function salvarImobiliaria(dados: ImobiliariaDados): Promise<{ erro?: string }> {
  if (dados.nm_imobiliaria.trim().length < 2) {
    return { erro: "Informe o nome da imobiliária." };
  }

  const supabase = await createClient();
  const linha = {
    nm_imobiliaria: dados.nm_imobiliaria.trim(),
    ds_cnpj: vazioParaNull(dados.ds_cnpj),
    ds_creci: vazioParaNull(dados.ds_creci),
    ds_endereco: vazioParaNull(dados.ds_endereco),
    ds_telefone: vazioParaNull(dados.ds_telefone),
    ds_email: vazioParaNull(dados.ds_email),
    sn_qualifica_contrato: dados.sn_qualifica_contrato,
  };

  const { error } = dados.cd_imobiliaria
    ? await supabase
        .schema("soma")
        .from("imobiliarias")
        .update(linha)
        .eq("cd_imobiliaria", dados.cd_imobiliaria)
    : await supabase.schema("soma").from("imobiliarias").insert(linha);

  if (error) {
    return { erro: error.message || "Não foi possível salvar." };
  }

  revalidar();
  return {};
}

export async function alternarAtivoImobiliaria(cdImobiliaria: string, snAtivo: boolean) {
  const supabase = await createClient();
  await supabase
    .schema("soma")
    .from("imobiliarias")
    .update({ sn_ativo: snAtivo })
    .eq("cd_imobiliaria", cdImobiliaria);
  revalidar();
}

// Cadastro rápido (a partir do formulário de novo processo): grava e devolve a imobiliária
// criada, pra já ficar selecionada. Só Master e Jurídico gravam (RLS).
export async function criarImobiliaria(
  dados: Omit<ImobiliariaDados, "cd_imobiliaria" | "sn_qualifica_contrato">
): Promise<{ erro: string } | { imobiliaria: Imobiliaria }> {
  if (dados.nm_imobiliaria.trim().length < 2) {
    return { erro: "Informe o nome da imobiliária." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("soma")
    .from("imobiliarias")
    .insert({
      nm_imobiliaria: dados.nm_imobiliaria.trim(),
      ds_cnpj: vazioParaNull(dados.ds_cnpj),
      ds_creci: vazioParaNull(dados.ds_creci),
      ds_endereco: vazioParaNull(dados.ds_endereco),
      ds_telefone: vazioParaNull(dados.ds_telefone),
      ds_email: vazioParaNull(dados.ds_email),
    })
    .select("*")
    .single<Imobiliaria>();

  if (error || !data) {
    return { erro: error?.message || "Não foi possível salvar." };
  }

  revalidar();
  return { imobiliaria: data };
}
