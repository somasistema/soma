"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LOCAL_SERVICO_LABEL, type LocalServico } from "@/types/database";

export function ServicosTabs({ locais }: { locais: LocalServico[] }) {
  const params = useParams<{ local?: string }>();
  const localAtivo = params.local?.toUpperCase();

  return (
    <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
      {locais.map((local) => (
        <Link
          key={local}
          href={`/servicos/${local}`}
          title={LOCAL_SERVICO_LABEL[local]}
          className={cn(
            "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
            localAtivo === local
              ? "bg-brand text-brand-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {local}
        </Link>
      ))}
    </div>
  );
}
