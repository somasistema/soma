import { cn } from "@/lib/utils";
import { STATUS_LABEL, type StatusOrcamento } from "@/types/database";

const STATUS_CLASS: Record<StatusOrcamento, string> = {
  pendente: "bg-status-pendente/15 text-status-pendente",
  aceito: "bg-status-aceito/15 text-status-aceito",
  pago: "bg-status-pago/15 text-status-pago",
  liberado: "bg-status-liberado/15 text-status-liberado",
  reprovado: "bg-status-reprovado/15 text-status-reprovado",
};

export function StatusBadge({ status, className }: { status: StatusOrcamento; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASS[status],
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
