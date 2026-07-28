"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth";
import { getSiteUrl } from "@/lib/mercadopago";
import { createServiceRoleClient } from "@/lib/supabase/server";

const ROLES_CRIAVEIS = [
  "master",
  "juridico",
  "imobiliaria",
  "despachante",
  "corretor",
  "vendedor",
  "outro_cliente",
] as const;

const usuarioSchema = z.object({
  nm_usuario: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
  ds_email: z.string().email("E-mail inválido."),
  tp_role: z.enum(ROLES_CRIAVEIS),
  cd_imobiliaria: z.string().optional(),
});

export type UsuarioActionState = { sucesso: true } | { sucesso: false; erro: string };

// Todas as escritas em soma.usuarios exigem service_role (a tabela só tem
// policy de SELECT — ver migration 001) — por isso a checagem de "é
// Master mesmo?" precisa ser feita aqui no código, não pela RLS.
async function exigirMaster() {
  const usuario = await getUsuarioAtual();
  if (usuario.tp_role !== "master") {
    throw new Error("Apenas Master pode gerenciar usuários.");
  }
}

export async function criarUsuario(
  _prevState: UsuarioActionState | null,
  formData: FormData
): Promise<UsuarioActionState> {
  try {
    await exigirMaster();
  } catch {
    return { sucesso: false, erro: "Apenas Master pode criar usuários." };
  }

  const parsed = usuarioSchema.safeParse({
    nm_usuario: formData.get("nm_usuario"),
    ds_email: formData.get("ds_email"),
    tp_role: formData.get("tp_role"),
    cd_imobiliaria: formData.get("cd_imobiliaria") || undefined,
  });

  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = createServiceRoleClient();

  const { data: existente } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("cd_usuario")
    .eq("ds_email", parsed.data.ds_email)
    .maybeSingle();

  if (existente) {
    return { sucesso: false, erro: "Já existe um usuário com esse e-mail." };
  }

  const siteUrl = getSiteUrl();
  const { data: convite, error: erroConvite } = await supabase.auth.admin.inviteUserByEmail(
    parsed.data.ds_email,
    { redirectTo: siteUrl ? `${siteUrl}/auth/definir-senha` : undefined }
  );

  if (erroConvite || !convite?.user) {
    return { sucesso: false, erro: erroConvite?.message ?? "Não foi possível enviar o convite." };
  }

  const { error: erroUsuario } = await supabase.schema("soma").from("usuarios").insert({
    cd_usuario: convite.user.id,
    nm_usuario: parsed.data.nm_usuario,
    ds_email: parsed.data.ds_email,
    tp_role: parsed.data.tp_role,
    cd_imobiliaria: parsed.data.cd_imobiliaria || null,
    sn_ativo: true,
  });

  if (erroUsuario) {
    return { sucesso: false, erro: erroUsuario.message };
  }

  revalidatePath("/usuarios");
  return { sucesso: true };
}

export async function alternarAtivoUsuario(cdUsuario: string, ativo: boolean): Promise<UsuarioActionState> {
  try {
    await exigirMaster();
  } catch {
    return { sucesso: false, erro: "Apenas Master pode gerenciar usuários." };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .schema("soma")
    .from("usuarios")
    .update({ sn_ativo: ativo })
    .eq("cd_usuario", cdUsuario);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  revalidatePath("/usuarios");
  return { sucesso: true };
}

export async function reenviarConvite(email: string): Promise<UsuarioActionState> {
  try {
    await exigirMaster();
  } catch {
    return { sucesso: false, erro: "Apenas Master pode gerenciar usuários." };
  }

  const supabase = createServiceRoleClient();
  const siteUrl = getSiteUrl();

  const { error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: siteUrl ? `${siteUrl}/auth/definir-senha` : undefined,
  });

  if (error) {
    return {
      sucesso: false,
      erro: "Não foi possível reenviar — se a pessoa já definiu a senha, ela só precisa fazer login normalmente.",
    };
  }

  return { sucesso: true };
}
