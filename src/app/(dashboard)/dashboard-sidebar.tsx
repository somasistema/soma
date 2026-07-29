"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

// Em telas pequenas a sidebar sai do fluxo normal e vira um drawer
// que abre por cima do conteúdo. Fecha sozinha ao trocar de rota —
// ajuste de estado durante a renderização (não em useEffect), padrão
// recomendado pelo React pra "resetar estado quando uma prop muda".
export function DashboardSidebar({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);

  if (pathname !== pathnameAnterior) {
    setPathnameAnterior(pathname);
    setOpen(false);
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 md:hidden">
        <Logo size="sm" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 -translate-x-full flex-col justify-between overflow-y-auto border-r border-border bg-card p-4 transition-transform duration-200 ease-out",
          "md:sticky md:top-0 md:z-auto md:w-60 md:translate-x-0",
          open && "translate-x-0"
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
          className="mb-2 self-end rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </aside>
    </>
  );
}
