"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type AbaProcesso = { href: string; rotulo: string; contador?: number | null };

// Abas do processo: cada uma é uma rota (carrega só os próprios dados).
// A primeira (Resumo) só fica ativa na rota exata.
export function ProcessoAbas({ abas }: { abas: AbaProcesso[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Seções do processo"
      className="flex gap-1 overflow-x-auto border-b border-border pb-px"
    >
      {abas.map((aba, i) => {
        const ativa = i === 0 ? pathname === aba.href : pathname.startsWith(aba.href);
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              ativa
                ? "border-brand text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {aba.rotulo}
            {aba.contador ? (
              <span className="rounded-full bg-status-pendente/15 px-1.5 text-xs text-status-pendente">
                {aba.contador}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
