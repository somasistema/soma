"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export type MeuPerfilState = { erro?: string; sucesso?: boolean } | null;

const dadosSchema = z.object({
  nm_usuario: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
  ds_telefone: z.string().optional(),
});

// Cada usuário só edita o próprio registro — cd_usuario vem da sessão
// validada (getUsuarioAtual), nunca de input do formulário, então não
// dá pra alguém editar o perfil de outra pessoa por aqui.
export async function atualizarMeusDados(
  _prevState: MeuPerfilState,
  formData: FormData
): Promise<MeuPerfilState> {
  const usuarioAtual = await getUsuarioAtual();

  const parsed = dadosSchema.safeParse({
    nm_usuario: formData.get("nm_usuario"),
    ds_telefone: formData.get("ds_telefone") || undefined,
  });

  if (!parsed.success) {
    return { erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .schema("soma")
    .from("usuarios")
    .update({
      nm_usuario: parsed.data.nm_usuario,
      ds_telefone: parsed.data.ds_telefone || null,
    })
    .eq("cd_usuario", usuarioAtual.cd_usuario);

  if (error) {
    return { erro: "Não foi possível salvar." };
  }

  revalidatePath("/meu-perfil");
  revalidatePath("/", "layout");
  return { sucesso: true };
}

export type TrocarSenhaState = { erro?: string; sucesso?: boolean } | null;

export async function trocarMinhaSenha(
  _prevState: TrocarSenhaState,
  formData: FormData
): Promise<TrocarSenhaState> {
  const senha = String(formData.get("senha") ?? "");
  const confirmacao = String(formData.get("confirmacao") ?? "");

  if (senha.length < 6) {
    return { erro: "A senha precisa ter ao menos 6 caracteres." };
  }
  if (senha !== confirmacao) {
    return { erro: "As senhas não coincidem." };
  }

  // Usa o client da própria sessão (não service_role) — só funciona
  // porque a pessoa já está autenticada, trocando a própria senha.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: senha });

  if (error) {
    return { erro: "Não foi possível trocar a senha." };
  }

  return { sucesso: true };
}
