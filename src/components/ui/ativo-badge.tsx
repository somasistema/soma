import { cn } from "@/lib/utils";

export function AtivoBadge({ ativo, className }: { ativo: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        ativo ? "bg-status-aceito/15 text-status-aceito" : "bg-muted-foreground/15 text-muted-foreground",
        className
      )}
    >
      {ativo ? "Ativo" : "Inativo"}
    </span>
  );
}
