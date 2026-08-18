import Link from "next/link";
import { getSecoesAcessiveis, getUsuarioAtual } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ROLE_LABEL, SECAO_ACESSO_LABEL, type SecaoAcesso } from "@/types/database";
import { logout } from "./actions";
import { DashboardSidebar } from "./dashboard-sidebar";
import { SidebarNav } from "./sidebar-nav";

// Ordem de exibição no menu — quais dessas seções cada perfil vê é
// configurável em Configurações > Perfil de acesso (ver migration
// 027); Master sempre vê todas (hardcoded).
const SECOES_MENU: SecaoAcesso[] = [
  "dashboard",
  "orcamentos",
  "processos",
  "servicos",
  "boletos",
  "usuarios",
  "configuracoes",
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioAtual();

  const secoesAcessiveis =
    usuario.tp_role === "master" ? new Set(SECOES_MENU) : await getSecoesAcessiveis(usuario.tp_role);

  const itensVisiveis = SECOES_MENU.filter((secao) => secoesAcessiveis.has(secao)).map((secao) => ({
    href: `/${secao}`,
    label: SECAO_ACESSO_LABEL[secao],
  }));

  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <DashboardSidebar>
        <div>
          <Logo size="lg" tagline={false} className="hidden px-2 md:flex" />
          <SidebarNav items={itensVisiveis} />
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <Link
            href="/meu-perfil"
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-muted"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-serif-doc text-sm font-bold text-accent">
              {usuario.nm_usuario.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{usuario.nm_usuario}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[usuario.tp_role]}</p>
            </div>
          </Link>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sair
            </Button>
          </form>
        </div>
      </DashboardSidebar>
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
