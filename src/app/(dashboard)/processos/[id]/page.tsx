import { notFound } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/utils";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import {
  STATUS_PENDENCIA_LABEL,
  TIPO_PROCESSO_LABEL,
  type Andamento,
  type Orcamento,
  type Pendencia,
  type Processo,
} from "@/types/database";
import { PendenciaForm } from "./pendencia-form";
import { PendenciaCheckbox } from "./pendencia-checkbox";

const PODE_CRIAR_PENDENCIA = new Set(["master", "juridico", "despachante"]);
const PODE_CRIAR_ORCAMENTO = new Set(["master", "juridico"]);

export default async function ProcessoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const { data: processo } = await supabase
    .schema("soma")
    .from("processos")
    .select("*")
    .eq("cd_processo", id)
    .single<Processo>();

  if (!processo) {
    notFound();
  }

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

  return (
    <FadeIn className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
          Processo {processo.ds_numero_processo}
        </h1>
        <p className="text-sm text-muted-foreground">
          {TIPO_PROCESSO_LABEL[processo.tp_processo]}
          {processo.nm_comprador_convidado ? ` — ${processo.nm_comprador_convidado}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Orçamentos</CardTitle>
          {PODE_CRIAR_ORCAMENTO.has(usuario.tp_role) && (
            <Link
              href={`/processos/${id}/orcamento-complementar`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Novo orçamento complementar
            </Link>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {orcamentos && orcamentos.length > 0 ? (
            orcamentos.map((orcamento) => (
              <Link
                key={orcamento.cd_orcamento}
                href={`/orcamentos/${orcamento.cd_orcamento}`}
                className="flex items-center justify-between rounded-radius border border-border p-3 hover:bg-muted/50"
              >
                <span className="text-sm text-foreground">
                  {formatarData(orcamento.ts_criacao)} — {formatarMoeda(orcamento.vl_total_geral)}
                </span>
                <StatusBadge status={orcamento.tp_status} />
              </Link>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum orçamento para este processo.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checklist documental / pendências</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {PODE_CRIAR_PENDENCIA.has(usuario.tp_role) && <PendenciaForm cdProcesso={id} />}

          {pendencias && pendencias.length > 0 ? (
            <StaggerList className="flex flex-col gap-2">
              {pendencias.map((pendencia) => (
                <StaggerItem
                  key={pendencia.cd_pendencia}
                  className="flex items-center justify-between gap-3 rounded-radius border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <PendenciaCheckbox
                      cdPendencia={pendencia.cd_pendencia}
                      status={pendencia.tp_status}
                    />
                    <div>
                      <p
                        className={`text-sm ${
                          pendencia.tp_status === "concluida"
                            ? "text-muted-foreground line-through"
                            : "text-foreground"
                        }`}
                      >
                        {pendencia.ds_pendencia}
                      </p>
                      {pendencia.dt_prazo && (
                        <p className="text-xs text-muted-foreground">
                          Prazo: {formatarData(pendencia.dt_prazo)}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {STATUS_PENDENCIA_LABEL[pendencia.tp_status]}
                  </span>
                </StaggerItem>
              ))}
            </StaggerList>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma pendência registrada.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log de andamentos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Registrado automaticamente a cada movimento do processo — não precisa preencher.
          </p>

          {andamentos && andamentos.length > 0 ? (
            <StaggerList className="flex flex-col gap-2">
              {andamentos.map((andamento) => (
                <StaggerItem
                  key={andamento.cd_andamento}
                  className="rounded-radius border border-border p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">{andamento.nm_etapa}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(andamento.ts_criacao).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{andamento.ds_andamento}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {andamento.usuarios?.nm_usuario ?? "Sistema"}
                  </p>
                </StaggerItem>
              ))}
            </StaggerList>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum andamento registrado ainda.</p>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
