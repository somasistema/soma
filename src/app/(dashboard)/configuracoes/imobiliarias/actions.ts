"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ImobiliariaDados {
  cd_imobiliaria: string | null;
  nm_imobiliaria: string;
  ds_cnpj: string;
  ds_creci: string;
  ds_endereco: string;
  ds_telefone: string;
  ds_email: string;
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
