import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Circle,
  FileCheck2,
  FilePlus2,
  FileSignature,
  ListChecks,
  Paperclip,
  Sparkles,
  XCircle,
} from "lucide-react";
import { cn, formatarData, formatarDataHora } from "@/lib/utils";
import type { Andamento, Orcamento, Pendencia } from "@/types/database";

type AndamentoComUsuario = Andamento & { usuarios: { nm_usuario: string } | null };

// Ícone/cor por palavra-chave no nm_etapa gravado pelos triggers
// automáticos (ver migrations 013/041) — cobre processo, orçamento,
// documento, pendência, minuta e contrato num só mapeamento.
function iconePorEtapa(nmEtapa: string) {
  const etapa = nmEtapa.toLowerCase();

  if (etapa.includes("pago")) return { Icon: Banknote, cor: "text-status-pago bg-status-pago/10" };
  if (etapa.includes("liberado"))
    return { Icon: CheckCircle2, cor: "text-status-liberado bg-status-liberado/10" };
  if (etapa.includes("aceito") || etapa.includes("aprovad"))
    return { Icon: CheckCircle2, cor: "text-status-aceito bg-status-aceito/10" };
  if (etapa.includes("reprovad") || etapa.includes("rejeitad"))
    return { Icon: XCircle, cor: "text-status-reprovado bg-status-reprovado/10" };
  if (etapa.includes("contrato"))
    return { Icon: FileCheck2, cor: "text-accent bg-accent/10" };
  if (etapa.includes("minuta")) return { Icon: FileSignature, cor: "text-accent bg-accent/10" };
  if (etapa.includes("documento")) return { Icon: Paperclip, cor: "text-brand bg-brand/5" };
  if (etapa.includes("pendênc") || etapa.includes("pendenc"))
    return { Icon: ListChecks, cor: "text-brand bg-brand/5" };
  if (etapa.includes("orçamento") || etapa.includes("orcamento"))
    return { Icon: FilePlus2, cor: "text-brand bg-brand/5" };
  if (etapa.includes("processo criado"))
    return { Icon: Sparkles, cor: "text-accent bg-accent/10" };

  return { Icon: Circle, cor: "text-muted-foreground bg-muted" };
}

function diasAte(dataISO: string) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${dataISO}T00:00:00`);
  return Math.round((alvo.getTime() - hoje.getTime()) / 86_400_000);
}

interface Alerta {
  chave: string;
  texto: string;
  vencido: boolean;
}

function montarAlertas(pendencias: Pendencia[], orcamentos: Orcamento[]): Alerta[] {
  const alertas: Alerta[] = [];

  for (const pendencia of pendencias) {
    if (pendencia.tp_status === "concluida" || !pendencia.dt_prazo) continue;
    const dias = diasAte(pendencia.dt_prazo);
    if (dias < 0) {
      alertas.push({
        chave: pendencia.cd_pendencia,
        texto: `Pendência atrasada — "${pendencia.ds_pendencia}" venceu em ${formatarData(pendencia.dt_prazo)}`,
        vencido: true,
      });
    } else if (dias <= 3) {
      alertas.push({
        chave: pendencia.cd_pendencia,
        texto: `Pendência vence em ${dias === 0 ? "hoje" : `${dias} dia(s)`} — "${pendencia.ds_pendencia}"`,
        vencido: false,
      });
    }
  }

  for (const orcamento of orcamentos) {
    if (orcamento.tp_status !== "pendente") continue;
    const dias = diasAte(orcamento.dt_validade);
    if (dias < 0) {
      alertas.push({
        chave: orcamento.cd_orcamento,
        texto: `Orçamento vencido — validade era ${formatarData(orcamento.dt_validade)}`,
        vencido: true,
      });
    } else if (dias <= 3) {
      alertas.push({
        chave: orcamento.cd_orcamento,
        texto: `Orçamento vence em ${dias === 0 ? "hoje" : `${dias} dia(s)`}`,
        vencido: false,
      });
    }
  }

  return alertas.sort((a, b) => Number(b.vencido) - Number(a.vencido));
}

export function TimelineProcesso({
  andamentos,
  pendencias,
  orcamentos,
}: {
  andamentos: AndamentoComUsuario[];
  pendencias: Pendencia[];
  orcamentos: Orcamento[];
}) {
  const alertas = montarAlertas(pendencias, orcamentos);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Registrado automaticamente a cada movimento do processo — não precisa preencher.
      </p>

      {alertas.length > 0 && (
        <div className="flex flex-col gap-2">
          {alertas.map((alerta) => (
            <div
              key={alerta.chave}
              className={cn(
                "flex items-center gap-2 rounded-radius border px-3 py-2 text-sm",
                alerta.vencido
                  ? "border-status-reprovado/30 bg-status-reprovado/10 text-status-reprovado"
                  : "border-status-pendente/30 bg-status-pendente/10 text-status-pendente"
              )}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {alerta.texto}
            </div>
          ))}
        </div>
      )}

      {andamentos.length > 0 ? (
        <ol className="relative flex flex-col gap-5 pl-9">
          <span aria-hidden className="absolute bottom-2 left-[15px] top-2 w-px bg-border" />
          {andamentos.map((andamento) => {
            const { Icon, cor } = iconePorEtapa(andamento.nm_etapa);
            return (
              <li key={andamento.cd_andamento} className="relative">
                <span
                  className={cn(
                    "absolute -left-9 flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-card",
                    cor
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">{andamento.nm_etapa}</p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {formatarDataHora(andamento.ts_criacao)}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{andamento.ds_andamento}</p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {andamento.usuarios?.nm_usuario ?? "Sistema"}
                </p>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum andamento registrado ainda.</p>
      )}
    </div>
  );
}
