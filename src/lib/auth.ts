import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PerfilAcesso, SecaoAcesso, Usuario } from "@/types/database";

export async function getUsuarioAtual(): Promise<Usuario> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("*")
    .eq("cd_usuario", user.id)
    .single<Usuario>();

  if (!usuario) {
    redirect("/login?erro=Usuário sem perfil cadastrado. Fale com o Master.");
  }

  return usuario;
}

// Quais seções o perfil do usuário pode acessar — configurável em
// Configurações > Perfil de acesso (ver migration 027). Master nunca
// passa por aqui (ver exigirAcessoSecao) e sempre acessa tudo.
export async function getSecoesAcessiveis(tpRole: Usuario["tp_role"]): Promise<Set<SecaoAcesso>> {
  const supabase = await createClient();

  const { data } = await supabase
    .schema("soma")
    .from("perfil_acesso")
    .select("cd_secao")
    .eq("tp_role", tpRole)
    .eq("sn_ativo", true)
    .returns<Pick<PerfilAcesso, "cd_secao">[]>();

  return new Set((data ?? []).map((row) => row.cd_secao));
}

// Barra o acesso à seção (redireciona pro dashboard) se o perfil não
// tiver permissão configurada — Master sempre passa, hardcoded, pra
// nunca se trancar fora da própria tela que configura isso.
export async function exigirAcessoSecao(usuario: Usuario, secao: SecaoAcesso) {
  if (usuario.tp_role === "master") return;

  const secoes = await getSecoesAcessiveis(usuario.tp_role);
  if (!secoes.has(secao)) {
    redirect("/dashboard");
  }
}
