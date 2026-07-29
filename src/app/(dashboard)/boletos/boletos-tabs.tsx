"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TABELA_CUSTA_LABEL, TABELAS_CUSTA, type TabelaCusta } from "@/types/database";

export function BoletosTabs() {
  const params = useParams<{ tabela?: string }>();
  const tabelaAtiva = params.tabela?.toUpperCase();

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
      {TABELAS_CUSTA.map((tabela: TabelaCusta) => (
        <Link
          key={tabela}
          href={`/boletos/${tabela}`}
          title={TABELA_CUSTA_LABEL[tabela]}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            tabelaAtiva === tabela
              ? "bg-brand text-brand-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {tabela}
        </Link>
      ))}
    </div>
  );
}
