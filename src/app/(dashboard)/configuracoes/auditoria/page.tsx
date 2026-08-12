import { getUsuarioAtual } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarDataHora } from "@/lib/utils";
import type { LogAuditoria } from "@/types/database";
import { LogDiff } from "@/components/log-diff";
import { AuditoriaFiltro } from "./auditoria-filtro";

const OPERACAO_LABEL: Record<LogAuditoria["tp_operacao"], string> = {
  INSERT: "Criou",
  UPDATE: "Editou",
  DELETE: "Excluiu",
};

const OPERACAO_COR: Record<LogAuditoria["tp_operacao"], string> = {
  INSERT: "text-status-aceito",
  UPDATE: "text-accent",
  DELETE: "text-status-reprovado",
};

type LogComUsuario = LogAuditoria & { usuarios: { nm_usuario: string } | null };

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ tabela?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  // Só Master lê essa tela — igual a RLS de soma.log_auditoria (ver
  // migration 033), reforçado aqui pra dar um redirect decente em vez
  // de uma tela vazia.
  if (usuario.tp_role !== "master") {
    redirect("/dashboard");
  }

  const { tabela } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .schema("soma")
    .from("log_auditoria")
    .select("*, usuarios(nm_usuario)")
    .order("ts_criacao", { ascending: false })
    .limit(200);

  if (tabela) {
    query = query.eq("nm_tabela", tabela);
  }

  const [{ data: logs }, { data: tabelasDistintas }] = await Promise.all([
    query.returns<LogComUsuario[]>(),
    supabase.schema("soma").from("log_auditoria").select("nm_tabela").returns<{ nm_tabela: string }[]>(),
  ]);

  const tabelas = Array.from(new Set((tabelasDistintas ?? []).map((t) => t.nm_tabela))).sort();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Toda mudança feita no sistema, quem fez e quando — últimas 200. Só Master vê essa tela.
        </p>
        <AuditoriaFiltro tabelas={tabelas} atual={tabela ?? ""} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(logs ?? []).map((log) => (
            <div key={log.cd_log} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm">
                  <span className={`font-medium ${OPERACAO_COR[log.tp_operacao]}`}>
                    {OPERACAO_LABEL[log.tp_operacao]}
                  </span>{" "}
                  <span className="text-foreground">{log.nm_tabela}</span>{" "}
                  <span className="text-muted-foreground">
                    — {log.usuarios?.nm_usuario ?? "Sistema"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">{formatarDataHora(log.ts_criacao)}</p>
              </div>
              <LogDiff
                operacao={log.tp_operacao}
                antigos={log.dados_antigos}
                novos={log.dados_novos}
              />
            </div>
          ))}
          {(!logs || logs.length === 0) && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum evento registrado ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
