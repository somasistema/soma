import { BarChart3, Download, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { exigirAcessoSecao, getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, formatarMoeda } from "@/lib/utils";
import {
  STATUS_LABEL,
  TIPO_PROCESSO_LABEL,
  type Orcamento,
  type Processo,
  type StatusOrcamento,
  type TipoProcesso,
} from "@/types/database";
import { StatusDonutChart, TendenciaChart, TipoProcessoBarChart } from "./kpis-charts";

// "Realizado" = já virou pagamento confirmado ou liberado pro
// despachante executar — pendente/aceito ainda é pipeline (pode cair),
// reprovado nunca vira receita.
const STATUS_REALIZADO: StatusOrcamento[] = ["pago", "liberado"];

const STATUS_DOT: Record<StatusOrcamento, string> = {
  pendente: "bg-status-pendente",
  aceito: "bg-status-aceito",
  pago: "bg-status-pago",
  liberado: "bg-status-liberado",
  reprovado: "bg-status-reprovado",
};

function primeiroDiaDoMes() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function paraData(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

function paraISO(data: Date) {
  return data.toISOString().slice(0, 10);
}

function somarDias(iso: string, dias: number) {
  const data = paraData(iso);
  data.setDate(data.getDate() + dias);
  return paraISO(data);
}

function diffDias(de: string, ate: string) {
  return Math.round((paraData(ate).getTime() - paraData(de).getTime()) / 86_400_000) + 1;
}

type OrcamentoComProcesso = Orcamento & { processos: Processo | null };

type Ranking = { chave: string; nome: string; qtd: number; vlTotal: number }[];

function montarRanking(
  orcamentos: OrcamentoComProcesso[],
  campo: "cd_corretor" | "cd_imobiliaria",
  nomes: Map<string, string>
): Ranking {
  const mapa = new Map<string, { qtd: number; vlTotal: number }>();

  for (const orcamento of orcamentos) {
    const chave = orcamento.processos?.[campo];
    if (!chave) continue;
    const atual = mapa.get(chave) ?? { qtd: 0, vlTotal: 0 };
    atual.qtd += 1;
    atual.vlTotal += orcamento.vl_total_geral;
    mapa.set(chave, atual);
  }

  return Array.from(mapa.entries())
    .map(([chave, valores]) => ({ chave, nome: nomes.get(chave) ?? "—", ...valores }))
    .sort((a, b) => b.vlTotal - a.vlTotal)
    .slice(0, 10);
}

function variacaoPercentual(atual: number, anterior: number) {
  if (anterior === 0) return atual > 0 ? 100 : 0;
  return ((atual - anterior) / anterior) * 100;
}

function VariacaoBadge({ percentual }: { percentual: number }) {
  const positivo = percentual >= 0;
  const Icon = positivo ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        positivo ? "text-status-liberado" : "text-status-reprovado"
      )}
    >
      <Icon className="h-3 w-3" />
      {Math.abs(percentual).toFixed(0)}%
    </span>
  );
}

export default async function KpisPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string }>;
}) {
  const usuario = await getUsuarioAtual();
  await exigirAcessoSecao(usuario, "kpis");

  const { de: deParam, ate: ateParam } = await searchParams;
  const de = deParam || primeiroDiaDoMes();
  const ate = ateParam || hojeISO();

  // Período anterior de mesma duração, imediatamente antes de "de" —
  // base de comparação pras setas de variação nos cards.
  const duracaoDias = diffDias(de, ate);
  const deAnterior = somarDias(de, -duracaoDias);
  const ateAnterior = somarDias(de, -1);

  const supabase = await createClient();

  const [{ data: orcamentos }, { data: orcamentosAnterior }, { data: usuarios }, { data: imobiliarias }] =
    await Promise.all([
      supabase
        .schema("soma")
        .from("orcamentos")
        .select("*, processos(*)")
        .gte("ts_criacao", `${de}T00:00:00`)
        .lt("ts_criacao", `${somarDias(ate, 1)}T00:00:00`)
        .returns<OrcamentoComProcesso[]>(),
      supabase
        .schema("soma")
        .from("orcamentos")
        .select("tp_status, vl_total_geral")
        .gte("ts_criacao", `${deAnterior}T00:00:00`)
        .lt("ts_criacao", `${somarDias(ateAnterior, 1)}T00:00:00`)
        .returns<Pick<Orcamento, "tp_status" | "vl_total_geral">[]>(),
      supabase.schema("soma").from("usuarios").select("cd_usuario, nm_usuario"),
      supabase.schema("soma").from("imobiliarias").select("cd_imobiliaria, nm_imobiliaria"),
    ]);

  const lista = orcamentos ?? [];
  const listaAnterior = orcamentosAnterior ?? [];

  const nomesUsuarios = new Map((usuarios ?? []).map((u) => [u.cd_usuario, u.nm_usuario]));
  const nomesImobiliarias = new Map(
    (imobiliarias ?? []).map((i) => [i.cd_imobiliaria, i.nm_imobiliaria])
  );

  const qtdTotal = lista.length;
  const vlTotalGeral = lista.reduce((soma, o) => soma + o.vl_total_geral, 0);
  const vlRealizado = lista
    .filter((o) => STATUS_REALIZADO.includes(o.tp_status))
    .reduce((soma, o) => soma + o.vl_total_geral, 0);
  const ticketMedio = qtdTotal > 0 ? vlTotalGeral / qtdTotal : 0;

  const qtdAnterior = listaAnterior.length;
  const vlTotalAnterior = listaAnterior.reduce((soma, o) => soma + o.vl_total_geral, 0);
  const vlRealizadoAnterior = listaAnterior
    .filter((o) => STATUS_REALIZADO.includes(o.tp_status))
    .reduce((soma, o) => soma + o.vl_total_geral, 0);
  const ticketMedioAnterior = qtdAnterior > 0 ? vlTotalAnterior / qtdAnterior : 0;

  const porStatus = (Object.keys(STATUS_LABEL) as StatusOrcamento[]).map((status) => {
    const doStatus = lista.filter((o) => o.tp_status === status);
    return {
      status,
      rotulo: STATUS_LABEL[status],
      qtd: doStatus.length,
      vlTotal: doStatus.reduce((soma, o) => soma + o.vl_total_geral, 0),
    };
  });

  const porTipoProcesso = (Object.keys(TIPO_PROCESSO_LABEL) as TipoProcesso[]).map((tipo) => {
    const doTipo = lista.filter((o) => o.processos?.tp_processo === tipo);
    return {
      tipo,
      rotulo: TIPO_PROCESSO_LABEL[tipo],
      qtd: doTipo.length,
      vlTotal: doTipo.reduce((soma, o) => soma + o.vl_total_geral, 0),
    };
  });

  const rankingCorretor = montarRanking(lista, "cd_corretor", nomesUsuarios);
  const rankingImobiliaria = montarRanking(lista, "cd_imobiliaria", nomesImobiliarias);

  // Tendência: um ponto por dia (range curto, o caso comum — filtro
  // parte sempre do mês atual) ou por mês (range longo, senão o
  // gráfico fica ilegível com dezenas de pontos diários).
  const porDia = duracaoDias <= 62;
  const baldes = new Map<string, number>();
  if (porDia) {
    for (let i = 0; i < duracaoDias; i++) baldes.set(somarDias(de, i), 0);
  } else {
    let cursor = new Date(paraData(de).getFullYear(), paraData(de).getMonth(), 1);
    const fim = paraData(ate);
    while (cursor <= fim) {
      baldes.set(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, 0);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }
  for (const o of lista) {
    if (!STATUS_REALIZADO.includes(o.tp_status)) continue;
    const chave = porDia ? o.ts_criacao.slice(0, 10) : o.ts_criacao.slice(0, 7);
    if (baldes.has(chave)) baldes.set(chave, (baldes.get(chave) ?? 0) + o.vl_total_geral);
  }
  const tendencia = Array.from(baldes.entries()).map(([chave, vlRealizado]) => ({
    rotulo: porDia
      ? `${chave.slice(8, 10)}/${chave.slice(5, 7)}`
      : `${chave.slice(5, 7)}/${chave.slice(2, 4)}`,
    vlRealizado,
  }));

  return (
    <div className="flex flex-col gap-6">
      <FadeIn className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-serif-doc text-2xl font-semibold text-foreground">
          <BarChart3 className="h-6 w-6 text-accent" />
          Indicadores
        </h1>
        <div className="flex flex-wrap items-end gap-2">
          <form className="flex flex-wrap items-end gap-2 text-sm" action="/kpis" method="get">
            <div className="flex flex-col gap-1">
              <label htmlFor="de" className="text-xs text-muted-foreground">
                De
              </label>
              <input
                id="de"
                name="de"
                type="date"
                defaultValue={de}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="ate" className="text-xs text-muted-foreground">
                Até
              </label>
              <input
                id="ate"
                name="ate"
                type="date"
                defaultValue={ate}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              />
            </div>
            <button
              type="submit"
              className="h-9 rounded-lg bg-brand px-4 text-sm font-medium text-brand-foreground"
            >
              Filtrar
            </button>
          </form>
          <button
            type="button"
            disabled
            title="Exportar em PDF/Excel — em breve"
            className="flex h-9 cursor-not-allowed items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-muted-foreground opacity-60"
          >
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </FadeIn>

      <FadeIn delay={0.04} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orçamentos no período
            </CardTitle>
            <VariacaoBadge percentual={variacaoPercentual(qtdTotal, qtdAnterior)} />
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">{qtdTotal}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento realizado
            </CardTitle>
            <VariacaoBadge percentual={variacaoPercentual(vlRealizado, vlRealizadoAnterior)} />
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatarMoeda(vlRealizado)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total em orçamentos
            </CardTitle>
            <VariacaoBadge percentual={variacaoPercentual(vlTotalGeral, vlTotalAnterior)} />
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatarMoeda(vlTotalGeral)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket médio</CardTitle>
            <VariacaoBadge percentual={variacaoPercentual(ticketMedio, ticketMedioAnterior)} />
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatarMoeda(ticketMedio)}
          </CardContent>
        </Card>
      </FadeIn>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn delay={0.08} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Faturamento realizado</CardTitle>
            </CardHeader>
            <CardContent>
              <TendenciaChart dados={tendencia} />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Orçamentos por status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <StatusDonutChart dados={porStatus} total={qtdTotal} />
              <div className="flex flex-col gap-2">
                {porStatus.map(({ status, rotulo, qtd, vlTotal }) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[status])} />
                      <span className="text-foreground">{rotulo}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {qtd} · {formatarMoeda(vlTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FadeIn delay={0.12}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Por tipo de processo</CardTitle>
            </CardHeader>
            <CardContent>
              <TipoProcessoBarChart dados={porTipoProcesso} />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.14}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Ranking por corretor</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {rankingCorretor.length > 0 ? (
                rankingCorretor.map((linha, i) => (
                  <div key={linha.chave} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {i + 1}. {linha.nome}
                    </span>
                    <span className="text-muted-foreground">
                      {linha.qtd} · {formatarMoeda(linha.vlTotal)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum orçamento do período tem corretor atribuído.
                </p>
              )}
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.16}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Ranking por imobiliária</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {rankingImobiliaria.length > 0 ? (
                rankingImobiliaria.map((linha, i) => (
                  <div key={linha.chave} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {i + 1}. {linha.nome}
                    </span>
                    <span className="text-muted-foreground">
                      {linha.qtd} · {formatarMoeda(linha.vlTotal)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum orçamento no período.</p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
