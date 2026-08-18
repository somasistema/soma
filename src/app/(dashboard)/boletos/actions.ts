"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { TABELAS_CUSTA } from "@/types/database";

const numeroOpcional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? Number(v) : null));

const custaSchema = z.object({
  tp_tabela: z.enum(TABELAS_CUSTA as [string, ...string[]]),
  nm_secao: z.string().min(1, "Informe a seção."),
  ds_ato: z.string().min(2, "Descrição deve ter ao menos 2 caracteres."),
  cd_ato: z.string().optional(),
  vl_faixa_min: numeroOpcional,
  vl_faixa_max: numeroOpcional,
  vl_pagar: numeroOpcional,
  ds_valor_especial: z.string().optional(),
  sn_desconto_primeiro_imovel: z.string().optional().transform((v) => v === "on"),
});

function parseFormData(formData: FormData) {
  return custaSchema.safeParse({
    tp_tabela: formData.get("tp_tabela"),
    nm_secao: formData.get("nm_secao"),
    ds_ato: formData.get("ds_ato"),
    cd_ato: formData.get("cd_ato"),
    vl_faixa_min: formData.get("vl_faixa_min"),
    vl_faixa_max: formData.get("vl_faixa_max"),
    vl_pagar: formData.get("vl_pagar"),
    ds_valor_especial: formData.get("ds_valor_especial"),
    sn_desconto_primeiro_imovel: formData.get("sn_desconto_primeiro_imovel"),
  });
}

export type CustaState = { erro?: string } | null;

export async function criarCusta(_prevState: CustaState, formData: FormData): Promise<CustaState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  // Sem campo de ordem no formulário — entra no fim da tabela por padrão.
  const { data: ultimo } = await supabase
    .schema("soma")
    .from("tabela_custas")
    .select("nr_ordem")
    .eq("tp_tabela", parsed.data.tp_tabela)
    .order("nr_ordem", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .schema("soma")
    .from("tabela_custas")
    .insert({
      tp_tabela: parsed.data.tp_tabela,
      nm_secao: parsed.data.nm_secao,
      ds_ato: parsed.data.ds_ato,
      cd_ato: parsed.data.cd_ato || null,
      vl_faixa_min: parsed.data.vl_faixa_min,
      vl_faixa_max: parsed.data.vl_faixa_max,
      vl_pagar: parsed.data.vl_pagar,
      ds_valor_especial: parsed.data.ds_valor_especial || null,
      sn_desconto_primeiro_imovel: parsed.data.sn_desconto_primeiro_imovel,
      nr_ordem: (ultimo?.nr_ordem ?? 0) + 10,
    });

  if (error) {
    return { erro: "Não foi possível salvar a taxa/emolumento." };
  }

  revalidatePath("/boletos", "layout");
  return null;
}

export async function atualizarCusta(
  cd_custa: string,
  _prevState: CustaState,
  formData: FormData
): Promise<CustaState> {
  const parsed = parseFormData(formData);

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .schema("soma")
    .from("tabela_custas")
    .update({
      nm_secao: parsed.data.nm_secao,
      ds_ato: parsed.data.ds_ato,
      cd_ato: parsed.data.cd_ato || null,
      vl_faixa_min: parsed.data.vl_faixa_min,
      vl_faixa_max: parsed.data.vl_faixa_max,
      vl_pagar: parsed.data.vl_pagar,
      ds_valor_especial: parsed.data.ds_valor_especial || null,
      sn_desconto_primeiro_imovel: parsed.data.sn_desconto_primeiro_imovel,
    })
    .eq("cd_custa", cd_custa);

  if (error) {
    return { erro: "Não foi possível atualizar a taxa/emolumento." };
  }

  revalidatePath("/boletos", "layout");
  return null;
}

export async function excluirCusta(cd_custa: string): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .schema("soma")
    .from("tabela_custas")
    .delete()
    .eq("cd_custa", cd_custa);

  if (error) {
    return { erro: "Não foi possível excluir a taxa/emolumento." };
  }

  revalidatePath("/boletos", "layout");
  return {};
}
