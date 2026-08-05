"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RoleUsuario, SecaoAcesso } from "@/types/database";

export async function alternarAcesso(
  tpRole: RoleUsuario,
  cdSecao: SecaoAcesso,
  snAtivo: boolean
): Promise<{ erro?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .schema("soma")
    .from("perfil_acesso")
    .update({ sn_ativo: snAtivo })
    .eq("tp_role", tpRole)
    .eq("cd_secao", cdSecao);

  if (error) {
    return { erro: "Não foi possível salvar." };
  }

  revalidatePath("/configuracoes/perfil-acesso");
  return {};
}
