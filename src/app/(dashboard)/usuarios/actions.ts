"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth";
import { getSiteUrl } from "@/lib/mercadopago";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enviarEmail } from "@/lib/resend";
import { templateConvite } from "@/lib/email-templates";

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

  // generateLink cria o usuário no Supabase Auth e devolve o link de
  // acesso, mas NÃO manda e-mail nenhum — quem envia é o Resend logo
  // abaixo, com o nosso próprio template.
  const { data: convite, error: erroConvite } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.ds_email,
    options: { redirectTo: siteUrl ? `${siteUrl}/auth/definir-senha` : undefined },
  });

  if (erroConvite || !convite?.user) {
    return { sucesso: false, erro: erroConvite?.message ?? "Não foi possível gerar o convite." };
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

  const { subject, html } = templateConvite({
    nome: parsed.data.nm_usuario,
    link: convite.properties.action_link,
    contexto: "equipe",
  });
  const { erro: erroEmail } = await enviarEmail({ to: parsed.data.ds_email, subject, html });

  revalidatePath("/usuarios");

  if (erroEmail) {
    return {
      sucesso: false,
      erro: `Usuário criado, mas não foi possível enviar o e-mail de convite: ${erroEmail}. Use "Reenviar convite" na lista.`,
    };
  }

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

  // O usuário já existe no Supabase Auth (criado no primeiro convite),
  // então usamos "recovery" em vez de "invite" — generateLink com tipo
  // "invite" só funciona pra e-mail que ainda não tem conta.
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: siteUrl ? `${siteUrl}/auth/definir-senha` : undefined },
  });

  if (error || !data) {
    return {
      sucesso: false,
      erro: "Não foi possível reenviar — se a pessoa já definiu a senha, ela só precisa fazer login normalmente.",
    };
  }

  const { subject, html } = templateConvite({
    nome: null,
    link: data.properties.action_link,
    contexto: "equipe",
  });
  const { erro: erroEmail } = await enviarEmail({ to: email, subject, html });

  if (erroEmail) {
    return { sucesso: false, erro: `Não foi possível enviar o e-mail: ${erroEmail}` };
  }

  return { sucesso: true };
}
