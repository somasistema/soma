"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AcaoPermissao, RoleUsuario, SecaoAcesso } from "@/types/database";

export async function alternarAcesso(
  tpRole: RoleUsuario,
  cdSecao: SecaoAcesso,
  acao: AcaoPermissao,
  valor: boolean
): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const coluna = `sn_${acao}`;

  const { error } = await supabase
    .schema("soma")
    .from("perfil_acesso")
    .update({ [coluna]: valor })
    .eq("tp_role", tpRole)
    .eq("cd_secao", cdSecao);

  if (error) {
    return { erro: "Não foi possível salvar." };
  }

  revalidatePath("/configuracoes/perfil-acesso");
  return {};
}
