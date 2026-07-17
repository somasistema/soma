import { getUsuarioAtual } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ROLE_LABEL, type RoleUsuario } from "@/types/database";
import { logout } from "./actions";
import { SidebarNav } from "./sidebar-nav";

const NAV_ITEMS: { href: string; label: string; roles?: RoleUsuario[] }[] = [
  { href: "/dashboard", label: "Início" },
  { href: "/orcamentos", label: "Orçamentos", roles: ["master", "juridico"] },
  { href: "/servicos", label: "Serviços", roles: ["master"] },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await getUsuarioAtual();

  const itensVisiveis = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(usuario.tp_role)
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 flex-col justify-between border-r border-border bg-card p-4">
        <div>
          <Logo size="sm" className="px-2" />
          <SidebarNav items={itensVisiveis} />
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-2.5 px-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand font-serif-doc text-sm font-bold text-accent">
              {usuario.nm_usuario.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{usuario.nm_usuario}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[usuario.tp_role]}</p>
            </div>
          </div>
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm" className="w-full">
              Sair
            </Button>
          </form>
        </div>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
