import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AcaoPermissao, PerfilAcesso, SecaoAcesso, Usuario } from "@/types/database";

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

// Quais seções o perfil do usuário pode VER — configurável em
// Configurações > Perfil de acesso (ver migrations 027/032). Master
// nunca passa por aqui (ver exigirAcessoSecao) e sempre acessa tudo.
export async function getSecoesAcessiveis(tpRole: Usuario["tp_role"]): Promise<Set<SecaoAcesso>> {
  const supabase = await createClient();

  const { data } = await supabase
    .schema("soma")
    .from("perfil_acesso")
    .select("cd_secao")
    .eq("tp_role", tpRole)
    .eq("sn_ver", true)
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

// Checagem granular de CRUD (ver/criar/editar/excluir) — usada nas 5
// seções que têm operações de escrita fora do alcance do RLS comum
// (ex: soma.usuarios só é gravável via service_role, então o RLS não
// protege nada ali; a checagem precisa ser feita aqui no app). Nas
// tabelas onde o RLS já consulta soma.fn_tem_permissao() diretamente
// (Serviços, Taxas e Emolumentos, Orçamentos), isso é redundante mas
// inofensivo — dá o erro mais cedo, com mensagem melhor.
export async function temPermissao(
  usuario: Usuario,
  secao: SecaoAcesso,
  acao: AcaoPermissao
): Promise<boolean> {
  if (usuario.tp_role === "master") return true;

  const supabase = await createClient();
  const coluna = `sn_${acao}` as const;

  const { data } = await supabase
    .schema("soma")
    .from("perfil_acesso")
    .select(coluna)
    .eq("tp_role", usuario.tp_role)
    .eq("cd_secao", secao)
    .maybeSingle<Record<string, boolean>>();

  return data?.[coluna] === true;
}
