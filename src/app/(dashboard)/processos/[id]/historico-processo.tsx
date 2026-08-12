"use client";

import { RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LogDiff } from "@/components/log-diff";
import { formatarDataHora } from "@/lib/utils";
import type { LogAuditoria } from "@/types/database";
import { reverterAlteracao } from "./historico-actions";

const TABELA_LABEL: Record<string, string> = {
  processos: "Dados do processo",
  orcamentos: "Orçamento",
  orcamento_servicos: "Item do orçamento",
};

const OPERACAO_LABEL: Record<LogAuditoria["tp_operacao"], string> = {
  INSERT: "Criado",
  UPDATE: "Editado",
  DELETE: "Excluído",
};

type LogComUsuario = LogAuditoria & { usuarios: { nm_usuario: string } | null };

function LinhaHistorico({ log, cdProcesso }: { log: LogComUsuario; cdProcesso: string }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [revertido, setRevertido] = useState(false);

  function reverter() {
    if (!confirm("Reverter essa alteração? Os campos voltam pro valor de antes desse evento.")) {
      return;
    }
    setErro(null);
    startTransition(async () => {
      const resultado = await reverterAlteracao(log.cd_log, cdProcesso);
      if (resultado.erro) {
        setErro(resultado.erro);
      } else {
        setRevertido(true);
      }
    });
  }

  return (
    <div className="border-t border-border pt-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="font-medium text-foreground">
            {TABELA_LABEL[log.nm_tabela] ?? log.nm_tabela}
          </span>{" "}
          <span className="text-muted-foreground">
            — {OPERACAO_LABEL[log.tp_operacao]} por {log.usuarios?.nm_usuario ?? "Sistema"}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">{formatarDataHora(log.ts_criacao)}</p>
      </div>
      <LogDiff operacao={log.tp_operacao} antigos={log.dados_antigos} novos={log.dados_novos} />
      {log.tp_operacao === "UPDATE" && !revertido && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={reverter}
          className="mt-1 gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {pending ? "Revertendo..." : "Reverter"}
        </Button>
      )}
      {revertido && <p className="mt-1 text-xs text-status-aceito">Revertido.</p>}
      {erro && <p className="mt-1 text-xs text-status-reprovado">{erro}</p>}
    </div>
  );
}

export function HistoricoProcesso({
  logs,
  cdProcesso,
}: {
  logs: LogComUsuario[];
  cdProcesso: string;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {logs.map((log) => (
        <LinhaHistorico key={log.cd_log} log={log} cdProcesso={cdProcesso} />
      ))}
    </div>
  );
}
