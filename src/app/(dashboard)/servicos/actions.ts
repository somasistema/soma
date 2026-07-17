"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const servicoSchema = z.object({
  nm_servico: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
  tp_servico: z.enum(["honorario", "custa"]),
  vl_servico: z.coerce.number().positive("Valor deve ser positivo."),
});

export type CriarServicoState = { erro?: string } | null;

export async function criarServico(
  _prevState: CriarServicoState,
  formData: FormData
): Promise<CriarServicoState> {
  const parsed = servicoSchema.safeParse({
    nm_servico: formData.get("nm_servico"),
    tp_servico: formData.get("tp_servico"),
    vl_servico: formData.get("vl_servico"),
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();

  const { error } = await supabase.schema("soma").from("servicos").insert({
    nm_servico: parsed.data.nm_servico,
    tp_servico: parsed.data.tp_servico,
    vl_servico: parsed.data.vl_servico,
    sn_ativo: true,
  });

  if (error) {
    return { erro: "Não foi possível salvar o serviço." };
  }

  revalidatePath("/servicos");
  return null;
}

export async function alternarAtivoServico(cd_servico: string, sn_ativo: boolean) {
  const supabase = await createClient();

  await supabase
    .schema("soma")
    .from("servicos")
    .update({ sn_ativo })
    .eq("cd_servico", cd_servico);

  revalidatePath("/servicos");
}
