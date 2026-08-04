import { createClient } from "@/lib/supabase/server";
import type {
  BlocoFluxo,
  Cidade,
  FluxoBloco,
  Imobiliaria,
  PacoteItem,
  ServicoComPrecos,
  TabelaCustaItem,
  TipoAplicavelFluxo,
} from "@/types/database";
import { CIDADES_SERVICO_PADRAO } from "@/types/database";
import { OrcamentoForm } from "./orcamento-form";

// Ordem padrão caso a migration 017 ainda não tenha rodado (sem
// nenhuma linha em soma.fluxo_blocos) — mesma sequência de sempre.
const ORDEM_PADRAO: BlocoFluxo[] = [
  "tipo_processo",
  "informacoes_basicas",
  "orgao",
  "tipo_servico",
  "selecao_servicos",
  "boletos",
];

export default async function NovoOrcamentoPage() {
  const supabase = await createClient();

  const [
    { data: imobiliarias },
    { data: servicos },
    { data: custas },
    { data: blocos },
    { data: cidadesDb },
    { data: pacoteItens },
  ] = await Promise.all([
      supabase
        .schema("soma")
        .from("imobiliarias")
        .select("*")
        .eq("sn_ativo", true)
        .order("nm_imobiliaria")
        .returns<Imobiliaria[]>(),
      supabase
        .schema("soma")
        .from("servicos")
        .select("*, servico_precos(*)")
        .eq("sn_ativo", true)
        .order("nm_categoria")
        .order("nm_servico")
        .returns<ServicoComPrecos[]>(),
      supabase
        .schema("soma")
        .from("tabela_custas")
        .select("*")
        .order("tp_tabela")
        .order("nr_ordem")
        .returns<TabelaCustaItem[]>(),
      // Ordenado pela posição X no canvas de Configurações > Fluxo —
      // arrastar um bloco pra esquerda/direita muda a ordem real aqui,
      // não é só cosmético no editor.
      supabase
        .schema("soma")
        .from("fluxo_blocos")
        .select("cd_bloco, sn_ativo, tp_aplicavel")
        .order("posicao_x")
        .returns<Pick<FluxoBloco, "cd_bloco" | "sn_ativo" | "tp_aplicavel">[]>(),
      supabase
        .schema("soma")
        .from("cidades")
        .select("*")
        .eq("sn_ativo", true)
        .order("nr_ordem")
        .returns<Cidade[]>(),
      supabase.schema("soma").from("pacote_itens").select("*").returns<PacoteItem[]>(),
    ]);

  const cidades =
    cidadesDb && cidadesDb.length > 0 ? cidadesDb.map((c) => c.nm_cidade) : CIDADES_SERVICO_PADRAO;

  // Bloco sem linha no banco (ainda não rodou a migration 017/018, por
  // exemplo) conta como ativo e aplicável aos dois tipos — nunca
  // esconde nada por omissão.
  const blocosAtivos = Object.fromEntries(
    (blocos ?? []).map((b) => [b.cd_bloco, b.sn_ativo])
  ) as Record<BlocoFluxo, boolean>;

  const blocosAplicaveis = Object.fromEntries(
    (blocos ?? []).map((b) => [b.cd_bloco, b.tp_aplicavel])
  ) as Record<BlocoFluxo, TipoAplicavelFluxo>;

  const ordemBlocos = blocos && blocos.length > 0 ? blocos.map((b) => b.cd_bloco) : ORDEM_PADRAO;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">Novo orçamento</h1>
      <OrcamentoForm
        imobiliarias={imobiliarias ?? []}
        servicos={servicos ?? []}
        custas={custas ?? []}
        cidades={cidades}
        blocosAtivos={blocosAtivos}
        blocosAplicaveis={blocosAplicaveis}
        ordemBlocos={ordemBlocos}
        pacoteItens={pacoteItens ?? []}
      />
    </div>
  );
}
