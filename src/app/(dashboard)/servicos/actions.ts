"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { LOCAIS_SERVICO } from "@/types/database";

const PRECO_PREFIXO = "preco__";

// Cidades são dinâmicas (soma.cidades, ver migration 019) — em vez de
// campos fixos por cidade, o form manda um input preco__<cidade> por
// cidade ativa, e aqui a gente varre o FormData procurando por eles.
function extrairPrecos(formData: FormData) {
  const precos: { nm_cidade: string; vl_valor: number }[] = [];

  for (const [chave, valor] of formData.entries()) {
    if (!chave.startsWith(PRECO_PREFIXO)) continue;
    const texto = String(valor).trim();
    if (texto === "") continue;
    precos.push({ nm_cidade: chave.slice(PRECO_PREFIXO.length), vl_valor: Number(texto) });
  }

  return precos;
}

const servicoBaseSchema = z.object({
  cd_codigo: z.string().optional(),
  nm_categoria: z.string().min(1, "Informe a categoria."),
  nm_servico: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
  sn_valor_variavel: z.coerce.boolean(),
  qtd_cidades: z.coerce.number(),
});

export type CriarServicoState = { erro?: string } | null;

export async function criarServico(
  _prevState: CriarServicoState,
  formData: FormData
): Promise<CriarServicoState> {
  const parsed = servicoBaseSchema
    .extend({ tp_local: z.enum(LOCAIS_SERVICO as [string, ...string[]]) })
    .safeParse({
      cd_codigo: formData.get("cd_codigo"),
      tp_local: formData.get("tp_local"),
      nm_categoria: formData.get("nm_categoria"),
      nm_servico: formData.get("nm_servico"),
      sn_valor_variavel: formData.get("sn_valor_variavel") === "on",
      qtd_cidades: formData.get("qtd_cidades"),
    });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const precos = extrairPrecos(formData);

  if (!parsed.data.sn_valor_variavel && precos.length < parsed.data.qtd_cidades) {
    return { erro: "Informe o valor em todas as cidades, ou marque como valor variável." };
  }

  const supabase = await createClient();

  const { data: servico, error } = await supabase
    .schema("soma")
    .from("servicos")
    .insert({
      cd_codigo: parsed.data.cd_codigo || null,
      tp_local: parsed.data.tp_local,
      nm_categoria: parsed.data.nm_categoria,
      nm_servico: parsed.data.nm_servico,
      tp_servico: "honorario",
      sn_valor_variavel: parsed.data.sn_valor_variavel,
      sn_ativo: true,
    })
    .select("cd_servico")
    .single();

  if (error || !servico) {
    return { erro: "Não foi possível salvar o serviço." };
  }

  if (!parsed.data.sn_valor_variavel && precos.length > 0) {
    const { error: erroPrecos } = await supabase
      .schema("soma")
      .from("servico_precos")
      .insert(precos.map((p) => ({ cd_servico: servico.cd_servico, ...p })));

    if (erroPrecos) {
      return { erro: "Serviço criado, mas não foi possível salvar os preços." };
    }
  }

  revalidatePath("/servicos", "layout");
  return null;
}

export async function alternarAtivoServico(cd_servico: string, sn_ativo: boolean) {
  const supabase = await createClient();

  await supabase
    .schema("soma")
    .from("servicos")
    .update({ sn_ativo })
    .eq("cd_servico", cd_servico);

  revalidatePath("/servicos", "layout");
}

export type AtualizarServicoState = { erro?: string } | null;

export async function atualizarServico(
  cd_servico: string,
  _prevState: AtualizarServicoState,
  formData: FormData
): Promise<AtualizarServicoState> {
  const parsed = servicoBaseSchema.safeParse({
    cd_codigo: formData.get("cd_codigo"),
    nm_categoria: formData.get("nm_categoria"),
    nm_servico: formData.get("nm_servico"),
    sn_valor_variavel: formData.get("sn_valor_variavel") === "on",
    qtd_cidades: formData.get("qtd_cidades"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const precos = extrairPrecos(formData);

  if (!parsed.data.sn_valor_variavel && precos.length < parsed.data.qtd_cidades) {
    return { erro: "Informe o valor em todas as cidades, ou marque como valor variável." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .schema("soma")
    .from("servicos")
    .update({
      cd_codigo: parsed.data.cd_codigo || null,
      nm_categoria: parsed.data.nm_categoria,
      nm_servico: parsed.data.nm_servico,
      sn_valor_variavel: parsed.data.sn_valor_variavel,
    })
    .eq("cd_servico", cd_servico);

  if (error) {
    return { erro: "Não foi possível atualizar o serviço." };
  }

  // Substitui os preços por completo em vez de fazer upsert seletivo —
  // mais simples e cobre tanto troca de valores quanto virar/deixar de
  // ser valor variável.
  const { error: erroLimpeza } = await supabase
    .schema("soma")
    .from("servico_precos")
    .delete()
    .eq("cd_servico", cd_servico);

  if (erroLimpeza) {
    return { erro: "Serviço atualizado, mas não foi possível ajustar os preços." };
  }

  if (!parsed.data.sn_valor_variavel && precos.length > 0) {
    const { error: erroPrecos } = await supabase
      .schema("soma")
      .from("servico_precos")
      .insert(precos.map((p) => ({ cd_servico, ...p })));

    if (erroPrecos) {
      return { erro: "Serviço atualizado, mas não foi possível salvar os preços." };
    }
  }

  revalidatePath("/servicos", "layout");
  return null;
}

export async function excluirServico(cd_servico: string): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.schema("soma").from("servicos").delete().eq("cd_servico", cd_servico);

  if (error) {
    // 23503 = foreign_key_violation — o serviço já foi usado em algum
    // orçamento (soma.orcamento_servicos não tem ON DELETE CASCADE de
    // propósito, pra nunca apagar item de orçamento já existente).
    if (error.code === "23503") {
      return {
        erro: "Esse serviço já foi usado em algum orçamento — não dá pra excluir, só desativar.",
      };
    }
    return { erro: "Não foi possível excluir o serviço." };
  }

  revalidatePath("/servicos", "layout");
  return {};
}
