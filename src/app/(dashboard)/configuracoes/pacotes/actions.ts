"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PacoteState = { erro?: string } | null;

export async function criarPacoteItem(
  _prevState: PacoteState,
  formData: FormData
): Promise<PacoteState> {
  const cdServico = String(formData.get("cd_servico") ?? "");
  const tpOrigem = String(formData.get("tp_origem") ?? "custa");
  const cdCusta = String(formData.get("cd_custa") ?? "");
  const tpTabelaFaixa = String(formData.get("tp_tabela_faixa") ?? "");
  const nmSecaoFaixa = String(formData.get("nm_secao_faixa") ?? "");
  const tpSecaoPadrao = String(formData.get("tp_secao_padrao") ?? "inicial");
  const snOpcional = formData.get("sn_opcional") === "on";

  if (!cdServico) {
    return { erro: "Escolha o serviço." };
  }

  const linha: Record<string, unknown> = {
    cd_servico: cdServico,
    tp_origem: tpOrigem,
    tp_secao_padrao: tpSecaoPadrao,
    sn_opcional: snOpcional,
    cd_custa: null,
    tp_tabela_faixa: null,
    nm_secao_faixa: null,
  };

  if (tpOrigem === "custa") {
    if (!cdCusta) return { erro: "Escolha a taxa/emolumento." };
    linha.cd_custa = cdCusta;
  } else if (tpOrigem === "faixa") {
    if (!tpTabelaFaixa || !nmSecaoFaixa) return { erro: "Escolha a tabela e a seção." };
    linha.tp_tabela_faixa = tpTabelaFaixa;
    linha.nm_secao_faixa = nmSecaoFaixa;
  }
  // tp_origem === "itiv": não precisa de mais nada.

  const supabase = await createClient();

  const { error } = await supabase.schema("soma").from("pacote_itens").insert(linha);

  if (error) {
    return {
      erro:
        error.code === "23505"
          ? "Esse vínculo já existe pra esse serviço."
          : "Não foi possível salvar.",
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
