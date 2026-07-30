"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CIDADES_SERVICO, LOCAIS_SERVICO } from "@/types/database";

const precoOpcional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? Number(v) : null));

const servicoSchema = z
  .object({
    cd_codigo: z.string().optional(),
    tp_local: z.enum(LOCAIS_SERVICO as [string, ...string[]]),
    nm_categoria: z.string().min(1, "Informe a categoria."),
    nm_servico: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
    sn_valor_variavel: z.coerce.boolean(),
    vl_salvador: precoOpcional,
    vl_lauro: precoOpcional,
    vl_camacari: precoOpcional,
  })
  .refine(
    (data) =>
      data.sn_valor_variavel ||
      (data.vl_salvador !== null && data.vl_lauro !== null && data.vl_camacari !== null),
    { message: "Informe o valor nas 3 cidades, ou marque como valor variável." }
  );

export type CriarServicoState = { erro?: string } | null;

export async function criarServico(
  _prevState: CriarServicoState,
  formData: FormData
): Promise<CriarServicoState> {
  const parsed = servicoSchema.safeParse({
    cd_codigo: formData.get("cd_codigo"),
    tp_local: formData.get("tp_local"),
    nm_categoria: formData.get("nm_categoria"),
    nm_servico: formData.get("nm_servico"),
    sn_valor_variavel: formData.get("sn_valor_variavel") === "on",
    vl_salvador: formData.get("vl_salvador"),
    vl_lauro: formData.get("vl_lauro"),
    vl_camacari: formData.get("vl_camacari"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
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

  if (!parsed.data.sn_valor_variavel) {
    const precos = [
      { cd_servico: servico.cd_servico, nm_cidade: CIDADES_SERVICO[0], vl_valor: parsed.data.vl_salvador },
      { cd_servico: servico.cd_servico, nm_cidade: CIDADES_SERVICO[1], vl_valor: parsed.data.vl_lauro },
      { cd_servico: servico.cd_servico, nm_cidade: CIDADES_SERVICO[2], vl_valor: parsed.data.vl_camacari },
    ];

    const { error: erroPrecos } = await supabase.schema("soma").from("servico_precos").insert(precos);

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
  const parsed = servicoSchema.safeParse({
    cd_codigo: formData.get("cd_codigo"),
    tp_local: formData.get("tp_local"),
    nm_categoria: formData.get("nm_categoria"),
    nm_servico: formData.get("nm_servico"),
    sn_valor_variavel: formData.get("sn_valor_variavel") === "on",
    vl_salvador: formData.get("vl_salvador"),
    vl_lauro: formData.get("vl_lauro"),
    vl_camacari: formData.get("vl_camacari"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
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

  if (!parsed.data.sn_valor_variavel) {
    const precos = [
      { cd_servico, nm_cidade: CIDADES_SERVICO[0], vl_valor: parsed.data.vl_salvador },
      { cd_servico, nm_cidade: CIDADES_SERVICO[1], vl_valor: parsed.data.vl_lauro },
      { cd_servico, nm_cidade: CIDADES_SERVICO[2], vl_valor: parsed.data.vl_camacari },
    ];

    const { error: erroPrecos } = await supabase.schema("soma").from("servico_precos").insert(precos);

    if (erroPrecos) {
      return { erro: "Serviço atualizado, mas não foi possível salvar os preços." };
    }
  }

  revalidatePath("/servicos", "layout");
  return null;
}

export async function excluirServico(
  cd_servico: string
): Promise<{ erro?: string }> {
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
