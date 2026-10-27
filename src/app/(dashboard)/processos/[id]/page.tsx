import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarDataHora, formatarMoeda } from "@/lib/utils";
import { STATUS_PENDENCIA_LABEL, type Andamento, type Pendencia } from "@/types/database";
import { PendenciaCheckbox } from "./pendencia-checkbox";
import { PendenciaForm } from "./pendencia-form";
import { carregarProcesso } from "./processo-dados";
import { ProximoPasso } from "./proximo-passo";

const PODE_CRIAR_PENDENCIA = new Set(["master", "juridico", "despachante"]);

const PAGAMENTO_LABEL: Record<string, string> = { financiado: "Financiado", a_vista: "À vista" };

export default async function ProcessoResumoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const processo = await carregarProcesso(id);
  if (!processo) notFound();
  const contrato = processo.tp_processo === "contrato";

  const [{ data: pendencias }, { data: andamentos }, { data: negocio }, { count: minutas }] =
    await Promise.all([
      supabase
        .schema("soma")
        .from("pendencias")
        .select("*")
        .eq("cd_processo", id)
        .order("ts_criacao", { ascending: false })
        .returns<Pendencia[]>(),
      supabase
        .schema("soma")
        .from("andamentos")
        .select("*")
        .eq("cd_processo", id)
        .order("ts_criacao", { ascending: false })
        .limit(5)
        .returns<Andamento[]>(),
      contrato
        ? supabase
            .schema("soma")
            .from("processo_negocio")
            .select("vl_imovel, tp_pagamento, vl_entrada, vl_financiamento, vl_honorarios_total")
            .eq("cd_processo", id)
            .maybeSingle<{
              vl_imovel: number | null;
              tp_pagamento: string | null;
              vl_entrada: number | null;
              vl_financiamento: number | null;
              vl_honorarios_total: number | null;
            }>()
        : Promise.resolve({ data: null }),
      supabase
        .schema("soma")
        .from("minutas")
        .select("cd_minuta", { count: "exact", head: true })
        .eq("cd_processo", id),
    ]);

  const abertas = (pendencias ?? []).filter((p) => p.tp_status !== "concluida").length;

  const numeros: { rotulo: string; valor: string }[] = negocio
    ? [
        { rotulo: "Valor do imóvel", valor: negocio.vl_imovel != null ? formatarMoeda(Number(negocio.vl_imovel)) : "—" },
        { rotulo: "Pagamento", valor: PAGAMENTO_LABEL[negocio.tp_pagamento ?? ""] ?? "—" },
        { rotulo: "Entrada", valor: negocio.vl_entrada != null ? formatarMoeda(Number(negocio.vl_entrada)) : "—" },
        { rotulo: "Financiamento", valor: negocio.vl_financiamento != null ? formatarMoeda(Number(negocio.vl_financiamento)) : "—" },
        { rotulo: "Honorários", valor: negocio.vl_honorarios_total != null ? formatarMoeda(Number(negocio.vl_honorarios_total)) : "—" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      {contrato && (
        <ProximoPasso
          cdProcesso={id}
          etapa={processo.tp_etapa_contrato}
          pendenciasAbertas={abertas}
          temMinuta={(minutas ?? 0) > 0}
        />
      )}

      {numeros.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>O negócio em resumo</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {numeros.map((n) => (
                <div key={n.rotulo}>
                  <dt className="text-xs text-muted-foreground">{n.rotulo}</dt>
                  <dd className="text-sm font-medium text-foreground">{n.valor}</dd>
                </div>
              ))}
            </dl>
            <Link
              href={`/processos/${id}/imovel`}
              className="mt-3 inline-block text-xs text-brand underline"
            >
              Ver imóvel e todos os valores
            </Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Checklist documental / pendências</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {PODE_CRIAR_PENDENCIA.has(usuario.tp_role) && <PendenciaForm cdProcesso={id} />}

          {pendencias && pendencias.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Marque a caixinha quando a pendência for resolvida — ela fica riscada como
              Concluída. Desmarcar reabre.
            </p>
          )}

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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Últimas atividades</CardTitle>
          <Link href={`/processos/${id}/atividade`} className="text-xs text-brand underline">
            Ver tudo
          </Link>
        </CardHeader>
        <CardContent>
          {andamentos && andamentos.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {andamentos.map((a) => (
                <li
                  key={a.cd_andamento}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-2 text-sm first:border-t-0 first:pt-0"
                >
                  <span className="text-foreground">
                    <strong className="font-medium">{a.nm_etapa}</strong>
                    {a.ds_andamento ? ` — ${a.ds_andamento}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatarDataHora(a.ts_criacao)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
