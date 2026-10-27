import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Andamento, LogAuditoria, Orcamento, Pendencia } from "@/types/database";
import { ChatProcesso } from "../chat-processo";
import { HistoricoProcesso } from "../historico-processo";
import { TimelineProcesso } from "../timeline-processo";

export default async function AtividadePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const [{ data: andamentos }, { data: pendencias }, { data: orcamentos }] = await Promise.all([
    supabase
      .schema("soma")
      .from("andamentos")
      .select("*, usuarios(nm_usuario)")
      .eq("cd_processo", id)
      .order("ts_criacao", { ascending: false })
      .returns<(Andamento & { usuarios: { nm_usuario: string } | null })[]>(),
    supabase
      .schema("soma")
      .from("pendencias")
      .select("*")
      .eq("cd_processo", id)
      .order("ts_criacao", { ascending: false })
      .returns<Pendencia[]>(),
    supabase
      .schema("soma")
      .from("orcamentos")
      .select("*")
      .eq("cd_processo", id)
      .order("ts_criacao", { ascending: false })
      .returns<Orcamento[]>(),
  ]);

  // Histórico com "reverter" — só Master vê (log_auditoria só é
  // legível por Master, ver migration 033). Junta o log do processo
  // em si, dos orçamentos dele, e dos itens desses orçamentos.
  type LogComUsuario = LogAuditoria & { usuarios: { nm_usuario: string } | null };
  let logsHistorico: LogComUsuario[] = [];
  if (usuario.tp_role === "master") {
    const cdsOrcamentos = (orcamentos ?? []).map((o) => o.cd_orcamento);

    const consultas = [
      supabase
        .schema("soma")
        .from("log_auditoria")
        .select("*, usuarios(nm_usuario)")
        .eq("nm_tabela", "processos")
        .eq("cd_registro", id)
        .returns<LogComUsuario[]>(),
    ];

    if (cdsOrcamentos.length > 0) {
      consultas.push(
        supabase
          .schema("soma")
          .from("log_auditoria")
          .select("*, usuarios(nm_usuario)")
          .eq("nm_tabela", "orcamentos")
          .in("cd_registro", cdsOrcamentos)
          .returns<LogComUsuario[]>(),
        supabase
          .schema("soma")
          .from("log_auditoria")
          .select("*, usuarios(nm_usuario)")
          .eq("nm_tabela", "orcamento_servicos")
          .or(
            cdsOrcamentos
              .flatMap((cd) => [
                `dados_novos->>cd_orcamento.eq.${cd}`,
                `dados_antigos->>cd_orcamento.eq.${cd}`,
              ])
              .join(",")
          )
          .returns<LogComUsuario[]>()
      );
    }

    const resultados = await Promise.all(consultas);
    logsHistorico = resultados
      .flatMap((r) => r.data ?? [])
      .sort((a, b) => b.ts_criacao.localeCompare(a.ts_criacao));
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Conversa do processo</CardTitle>
        </CardHeader>
        <CardContent>
          <ChatProcesso cdProcesso={id} cdUsuarioAtual={usuario.cd_usuario} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline do processo</CardTitle>
        </CardHeader>
        <CardContent>
          <TimelineProcesso
            andamentos={andamentos ?? []}
            pendencias={pendencias ?? []}
            orcamentos={orcamentos ?? []}
          />
        </CardContent>
      </Card>

      {usuario.tp_role === "master" && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de alterações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Mudanças nos dados do processo, do orçamento e dos itens — dá pra reverter uma
              edição pro valor de antes. Status (pago, aceito etc) nunca é revertido por aqui.
            </p>
            <HistoricoProcesso logs={logsHistorico} cdProcesso={id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
