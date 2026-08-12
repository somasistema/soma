"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function reverterAlteracao(
  cdLog: string,
  cdProcesso: string
): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.schema("soma").rpc("fn_reverter_log", { p_cd_log: cdLog });

  if (error) {
    return { erro: error.message };
  }

  revalidatePath(`/processos/${cdProcesso}`);
  return {};
}
