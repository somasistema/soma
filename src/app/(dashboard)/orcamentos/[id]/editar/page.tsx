import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CIDADES_SERVICO_PADRAO,
  type Cidade,
  type Orcamento,
  type OrcamentoServico,
  type PacoteItem,
  type Processo,
  type ServicoComPrecos,
  type TabelaCustaItem,
} from "@/types/database";
import { OrcamentoEditarForm } from "./orcamento-editar-form";

export default async function OrcamentoEditarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: orcamento } = await supabase
    .schema("soma")
    .from("orcamentos")
    .select("*")
    .eq("cd_orcamento", id)
    .single<Orcamento>();

  if (!orcamento) {
    notFound();
  }

  // Editar só faz sentido enquanto o cliente ainda não decidiu nada —
  // depois do aceite/pagamento, o conteúdo fica travado (regra
  // reforçada de novo dentro de fn_atualizar_orcamento).
  if (orcamento.tp_status !== "pendente") {
    redirect(`/orcamentos/${id}`);
  }

  const [
    { data: processo },
    { data: itens },
    { data: servicos },
    { data: custas },
    { data: cidadesDb },
    { data: pacoteItens },
  ] = await Promise.all([
    supabase.schema("soma").from("processos").select("*").eq("cd_processo", orcamento.cd_processo).single<Processo>(),
    supabase
      .schema("soma")
      .from("orcamento_servicos")
      .select("*")
      .eq("cd_orcamento", id)
      .returns<OrcamentoServico[]>(),
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
    supabase.schema("soma").from("cidades").select("*").eq("sn_ativo", true).order("nr_ordem").returns<Cidade[]>(),
    supabase.schema("soma").from("pacote_itens").select("*").returns<PacoteItem[]>(),
  ]);

  if (!processo) {
    notFound();
  }

  const cidades =
    cidadesDb && cidadesDb.length > 0 ? cidadesDb.map((c) => c.nm_cidade) : CIDADES_SERVICO_PADRAO;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
        Editar orçamento — Processo {processo.ds_numero_processo}
      </h1>
      <OrcamentoEditarForm
        cdOrcamento={orcamento.cd_orcamento}
        tpProcesso={processo.tp_processo}
        nmCidadeInicial={orcamento.nm_cidade}
        dtValidadeInicial={orcamento.dt_validade}
        dsInscricaoMunicipalInicial={orcamento.ds_inscricao_municipal ?? ""}
        vlTransacaoInicial={orcamento.vl_transacao != null ? String(orcamento.vl_transacao) : ""}
        vlVenalInicial={orcamento.vl_venal != null ? String(orcamento.vl_venal) : ""}
        itensIniciais={itens ?? []}
        servicos={servicos ?? []}
        custas={custas ?? []}
        cidades={cidades}
        pacoteItens={pacoteItens ?? []}
      />
    </div>
  );
}
