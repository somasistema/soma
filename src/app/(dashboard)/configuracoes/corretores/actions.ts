"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CorretorDados {
  cd_corretor: string | null;
  nm_corretor: string;
  ds_cpf: string;
  ds_creci: string;
  ds_telefone: string;
  ds_email: string;
  ds_pix: string;
  ds_conta_bancaria: string;
}

const vazioParaNull = (s: string) => (s.trim() === "" ? null : s.trim());

function revalidar() {
  revalidatePath("/configuracoes/corretores");
  revalidatePath("/processos/novo");
}

// Escrita direta na tabela — a RLS (migration 056) só deixa Master e
// Jurídico gravar.
export async function salvarCorretor(dados: CorretorDados): Promise<{ erro?: string }> {
  if (dados.nm_corretor.trim().length < 2) {
    return { erro: "Informe o nome do corretor." };
  }

  const supabase = await createClient();
  const linha = {
    nm_corretor: dados.nm_corretor.trim(),
    ds_cpf: vazioParaNull(dados.ds_cpf),
    ds_creci: vazioParaNull(dados.ds_creci),
    ds_telefone: vazioParaNull(dados.ds_telefone),
    ds_email: vazioParaNull(dados.ds_email),
    ds_pix: vazioParaNull(dados.ds_pix),
    ds_conta_bancaria: vazioParaNull(dados.ds_conta_bancaria),
  };

  const { error } = dados.cd_corretor
    ? await supabase.schema("soma").from("corretores").update(linha).eq("cd_corretor", dados.cd_corretor)
    : await supabase.schema("soma").from("corretores").insert(linha);

  if (error) {
    return { erro: error.message || "Não foi possível salvar." };
  }

  revalidar();
  return {};
}

export async function alternarAtivoCorretor(cdCorretor: string, snAtivo: boolean) {
  const supabase = await createClient();
  await supabase
    .schema("soma")
    .from("corretores")
    .update({ sn_ativo: snAtivo })
    .eq("cd_corretor", cdCorretor);
  revalidar();
}

export async function excluirCorretor(cdCorretor: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .schema("soma")
    .from("corretores")
    .delete()
    .eq("cd_corretor", cdCorretor);

  if (error) {
    return { erro: "Não foi possível excluir o corretor." };
  }

  revalidar();
  return {};
}
