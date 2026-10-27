import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TipoEtapaContrato } from "@/types/database";

const ETAPAS: { chave: string; rotulo: string; etapas: TipoEtapaContrato[] }[] = [
  { chave: "doc", rotulo: "Documentação", etapas: ["documentacao"] },
  { chave: "minuta", rotulo: "Minuta", etapas: ["minuta_pendente", "minuta_reprovada"] },
  { chave: "assinatura", rotulo: "Assinatura", etapas: ["aguardando_assinatura"] },
  { chave: "fim", rotulo: "Concluído", etapas: ["concluido"] },
];

// Faixa de progresso do contrato: etapas anteriores marcadas, a atual
// destacada.
export function EtapasProgresso({ etapa }: { etapa: TipoEtapaContrato | null }) {
  if (!etapa) return null;
  const atual = ETAPAS.findIndex((e) => e.etapas.includes(etapa));

  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {ETAPAS.map((e, i) => {
        const feita = i < atual || etapa === "concluido";
        const ativa = i === atual && etapa !== "concluido";
        return (
          <li key={e.chave} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium",
                feita && "bg-status-aceito/15 text-status-aceito",
                ativa &&
                  (etapa === "minuta_reprovada"
                    ? "bg-status-reprovado/15 text-status-reprovado"
                    : "bg-brand text-brand-foreground"),
                !feita && !ativa && "bg-muted text-muted-foreground"
              )}
            >
              {feita && <Check className="h-3 w-3" />}
              {e.rotulo}
            </span>
            {i < ETAPAS.length - 1 && <span className="h-px w-4 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
