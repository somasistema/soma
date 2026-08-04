import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CIDADES_SERVICO_PADRAO,
  type Cidade,
  type PacoteItem,
  type Processo,
  type ServicoComPrecos,
  type TabelaCustaItem,
} from "@/types/database";
import { OrcamentoComplementarForm } from "./orcamento-complementar-form";

export default async function OrcamentoComplementarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: processo },
    { data: servicos },
    { data: custas },
    { data: cidadesDb },
    { data: pacoteItens },
  ] = await Promise.all([
      supabase.schema("soma").from("processos").select("*").eq("cd_processo", id).single<Processo>(),
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
      supabase
        .schema("soma")
        .from("cidades")
        .select("*")
        .eq("sn_ativo", true)
        .order("nr_ordem")
        .returns<Cidade[]>(),
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
        Orçamento complementar — Processo {processo.ds_numero_processo}
      </h1>
      <OrcamentoComplementarForm
        cdProcesso={id}
        tpProcesso={processo.tp_processo}
        servicos={servicos ?? []}
        custas={custas ?? []}
        cidades={cidades}
        pacoteItens={pacoteItens ?? []}
      />
    </div>
  );
}
