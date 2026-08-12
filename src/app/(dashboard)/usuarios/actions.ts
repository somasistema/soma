"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual, temPermissao } from "@/lib/auth";
import { getSiteUrl } from "@/lib/mercadopago";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enviarEmail } from "@/lib/resend";
import { templateConvite } from "@/lib/email-templates";
import { registrarAuditoria } from "@/lib/auditoria";
import type { AcaoPermissao, Usuario } from "@/types/database";

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
// policy de SELECT — ver migration 001), então o RLS não protege nada
// aqui — a checagem de permissão granular (ver migration 032) precisa
// ser feita neste código mesmo.
async function exigirPermissaoUsuarios(acao: AcaoPermissao): Promise<Usuario> {
  const usuario = await getUsuarioAtual();
  if (!(await temPermissao(usuario, "usuarios", acao))) {
    throw new Error("Seu perfil não tem permissão pra essa ação em Usuários.");
  }
  return usuario;
}

export async function criarUsuario(
  _prevState: UsuarioActionState | null,
  formData: FormData
): Promise<UsuarioActionState> {
  let usuarioAtual: Usuario;
  try {
    usuarioAtual = await exigirPermissaoUsuarios("criar");
  } catch {
    return { sucesso: false, erro: "Seu perfil não tem permissão pra criar usuários." };
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

  await registrarAuditoria({
    cdUsuario: usuarioAtual.cd_usuario,
    nmTabela: "usuarios",
    tpOperacao: "INSERT",
    cdRegistro: convite.user.id,
    dadosNovos: {
      nm_usuario: parsed.data.nm_usuario,
      ds_email: parsed.data.ds_email,
      tp_role: parsed.data.tp_role,
      cd_imobiliaria: parsed.data.cd_imobiliaria || null,
    },
  });

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

const atualizarSchema = z.object({
  nm_usuario: z.string().min(2, "Nome deve ter ao menos 2 caracteres."),
  ds_email: z.string().email("E-mail inválido."),
  tp_role: z.enum(ROLES_CRIAVEIS),
  cd_imobiliaria: z.string().optional(),
});

export async function atualizarUsuario(
  cdUsuario: string,
  _prevState: UsuarioActionState | null,
  formData: FormData
): Promise<UsuarioActionState> {
  let usuarioAtual: Usuario;
  try {
    usuarioAtual = await exigirPermissaoUsuarios("editar");
  } catch {
    return { sucesso: false, erro: "Seu perfil não tem permissão pra editar usuários." };
  }

  const parsed = atualizarSchema.safeParse({
    nm_usuario: formData.get("nm_usuario"),
    ds_email: formData.get("ds_email"),
    tp_role: formData.get("tp_role"),
    cd_imobiliaria: formData.get("cd_imobiliaria") || undefined,
  });

  if (!parsed.success) {
    return { sucesso: false, erro: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = createServiceRoleClient();

  const { data: dadosAntigos } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("nm_usuario, ds_email, tp_role, cd_imobiliaria")
    .eq("cd_usuario", cdUsuario)
    .maybeSingle();

  const { data: emailEmUso } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("cd_usuario")
    .eq("ds_email", parsed.data.ds_email)
    .neq("cd_usuario", cdUsuario)
    .maybeSingle();

  if (emailEmUso) {
    return { sucesso: false, erro: "Já existe outro usuário com esse e-mail." };
  }

  // E-mail muda em soma.usuarios E no Supabase Auth (senão a pessoa
  // fica sem conseguir logar com o e-mail novo) — os dois precisam
  // ficar em sincronia.
  const { error: erroAuth } = await supabase.auth.admin.updateUserById(cdUsuario, {
    email: parsed.data.ds_email,
  });

  if (erroAuth) {
    return { sucesso: false, erro: `Não foi possível atualizar o e-mail de login: ${erroAuth.message}` };
  }

  const { error } = await supabase
    .schema("soma")
    .from("usuarios")
    .update({
      nm_usuario: parsed.data.nm_usuario,
      ds_email: parsed.data.ds_email,
      tp_role: parsed.data.tp_role,
      cd_imobiliaria: parsed.data.cd_imobiliaria || null,
    })
    .eq("cd_usuario", cdUsuario);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  await registrarAuditoria({
    cdUsuario: usuarioAtual.cd_usuario,
    nmTabela: "usuarios",
    tpOperacao: "UPDATE",
    cdRegistro: cdUsuario,
    dadosAntigos,
    dadosNovos: {
      nm_usuario: parsed.data.nm_usuario,
      ds_email: parsed.data.ds_email,
      tp_role: parsed.data.tp_role,
      cd_imobiliaria: parsed.data.cd_imobiliaria || null,
    },
  });

  revalidatePath("/usuarios");
  return { sucesso: true };
}

// Cada linha aqui é uma tabela/coluna onde soma.usuarios é referenciado
// — antes de excluir de verdade, confere se a pessoa tem histórico
// vinculado (processo, orçamento, pendência, documento...). Excluir com
// vínculo quebraria esses registros antigos, então bloqueia e sugere só
// desativar.
const VINCULOS_USUARIO: { tabela: string; coluna: string; rotulo: string }[] = [
  { tabela: "processos", coluna: "cd_comprador", rotulo: "processo (comprador)" },
  { tabela: "processos", coluna: "cd_vendedor", rotulo: "processo (vendedor)" },
  { tabela: "processos", coluna: "cd_corretor", rotulo: "processo (corretor)" },
  { tabela: "processos", coluna: "cd_despachante", rotulo: "processo (despachante)" },
  { tabela: "orcamentos", coluna: "cd_criador", rotulo: "orçamento criado" },
  { tabela: "pendencias", coluna: "cd_liberador", rotulo: "pendência liberada" },
  { tabela: "pendencias", coluna: "cd_responsavel", rotulo: "pendência" },
  { tabela: "documentos", coluna: "cd_enviado_por", rotulo: "documento enviado" },
  { tabela: "documentos", coluna: "cd_validador", rotulo: "documento validado" },
  { tabela: "andamentos", coluna: "cd_despachante", rotulo: "andamento" },
];

export async function excluirUsuario(cdUsuario: string): Promise<UsuarioActionState> {
  let usuarioAtual: Usuario;
  try {
    usuarioAtual = await exigirPermissaoUsuarios("excluir");
  } catch {
    return { sucesso: false, erro: "Seu perfil não tem permissão pra excluir usuários." };
  }

  const supabase = createServiceRoleClient();

  const { data: dadosAntigos } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("nm_usuario, ds_email, tp_role, cd_imobiliaria")
    .eq("cd_usuario", cdUsuario)
    .maybeSingle();

  const vinculosEncontrados: string[] = [];
  for (const vinculo of VINCULOS_USUARIO) {
    const { data } = await supabase
      .schema("soma")
      .from(vinculo.tabela)
      .select(vinculo.coluna)
      .eq(vinculo.coluna, cdUsuario)
      .limit(1);
    if (data && data.length > 0) vinculosEncontrados.push(vinculo.rotulo);
  }

  if (vinculosEncontrados.length > 0) {
    return {
      sucesso: false,
      erro: `Não é possível excluir — esse usuário está vinculado a: ${vinculosEncontrados.join(", ")}. Desative em vez de excluir.`,
    };
  }

  // Apaga do Supabase Auth — soma.usuarios cai junto (ON DELETE CASCADE).
  const { error } = await supabase.auth.admin.deleteUser(cdUsuario);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  await registrarAuditoria({
    cdUsuario: usuarioAtual.cd_usuario,
    nmTabela: "usuarios",
    tpOperacao: "DELETE",
    cdRegistro: cdUsuario,
    dadosAntigos,
  });

  revalidatePath("/usuarios");
  return { sucesso: true };
}

export async function alternarAtivoUsuario(cdUsuario: string, ativo: boolean): Promise<UsuarioActionState> {
  try {
    await exigirPermissaoUsuarios("editar");
  } catch {
    return { sucesso: false, erro: "Seu perfil não tem permissão pra editar usuários." };
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
    await exigirPermissaoUsuarios("editar");
  } catch {
    return { sucesso: false, erro: "Seu perfil não tem permissão pra editar usuários." };
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
