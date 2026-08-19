import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { FadeIn } from "@/components/motion/fade-in";
import { exigirAcessoSecao, getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import {
  STATUS_LABEL,
  TIPO_PROCESSO_LABEL,
  type Orcamento,
  type Processo,
  type StatusOrcamento,
  type TipoProcesso,
} from "@/types/database";

// "Realizado" = já virou pagamento confirmado ou liberado pro
// despachante executar — pendente/aceito ainda é pipeline (pode cair),
// reprovado nunca vira receita.
const STATUS_REALIZADO: StatusOrcamento[] = ["pago", "liberado"];

function primeiroDiaDoMes() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function proximoDiaISO(data: string) {
  const [ano, mes, dia] = data.split("-").map(Number);
  const proximo = new Date(ano, mes - 1, dia + 1);
  return proximo.toISOString().slice(0, 10);
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

  const supabase = await createClient();

  const [{ data: orcamentos }, { data: usuarios }, { data: imobiliarias }] = await Promise.all([
    supabase
      .schema("soma")
      .from("orcamentos")
      .select("*, processos(*)")
      .gte("ts_criacao", `${de}T00:00:00`)
      .lt("ts_criacao", `${proximoDiaISO(ate)}T00:00:00`)
      .returns<OrcamentoComProcesso[]>(),
    supabase.schema("soma").from("usuarios").select("cd_usuario, nm_usuario"),
    supabase.schema("soma").from("imobiliarias").select("cd_imobiliaria, nm_imobiliaria"),
  ]);

  const lista = orcamentos ?? [];

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

  const porStatus = (Object.keys(STATUS_LABEL) as StatusOrcamento[]).map((status) => {
    const doStatus = lista.filter((o) => o.tp_status === status);
    return {
      status,
      qtd: doStatus.length,
      vlTotal: doStatus.reduce((soma, o) => soma + o.vl_total_geral, 0),
    };
  });

  const porTipoProcesso = (Object.keys(TIPO_PROCESSO_LABEL) as TipoProcesso[]).map((tipo) => {
    const doTipo = lista.filter((o) => o.processos?.tp_processo === tipo);
    return {
      tipo,
      qtd: doTipo.length,
      vlTotal: doTipo.reduce((soma, o) => soma + o.vl_total_geral, 0),
    };
  });

  const rankingCorretor = montarRanking(lista, "cd_corretor", nomesUsuarios);
  const rankingImobiliaria = montarRanking(lista, "cd_imobiliaria", nomesImobiliarias);

  return (
    <div className="flex flex-col gap-6">
      <FadeIn className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 font-serif-doc text-2xl font-semibold text-foreground">
          <BarChart3 className="h-6 w-6 text-accent" />
          Indicadores
        </h1>
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
      </FadeIn>

      <FadeIn delay={0.04} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Orçamentos no período
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">{qtdTotal}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Faturamento realizado
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatarMoeda(vlRealizado)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total em orçamentos (todos os status)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatarMoeda(vlTotalGeral)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ticket médio
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-foreground">
            {formatarMoeda(ticketMedio)}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.08} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Por status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {porStatus.map(({ status, qtd, vlTotal }) => (
              <div key={status} className="flex items-center justify-between text-sm">
                <StatusBadge status={status} />
                <span className="text-muted-foreground">
                  {qtd} · {formatarMoeda(vlTotal)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Por tipo de processo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {porTipoProcesso.map(({ tipo, qtd, vlTotal }) => (
              <div key={tipo} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{TIPO_PROCESSO_LABEL[tipo]}</span>
                <span className="text-muted-foreground">
                  {qtd} · {formatarMoeda(vlTotal)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </FadeIn>

      <FadeIn delay={0.12} className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
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

        <Card>
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
  );
}
