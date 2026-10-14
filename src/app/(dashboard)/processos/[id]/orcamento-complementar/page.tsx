import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CIDADES_SERVICO_PADRAO,
  type Cidade,
  CARTORIOS_IMOVEIS,
  type PacoteItem,
  type ProcessoNegocio,
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
    { count: qtdOrcamentos },
    { data: negocio },
    { data: partes },
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
      supabase
        .schema("soma")
        .from("orcamentos")
        .select("cd_orcamento", { count: "exact", head: true })
        .eq("cd_processo", id),
      supabase
        .schema("soma")
        .from("processo_negocio")
        .select("*")
        .eq("cd_processo", id)
        .maybeSingle<ProcessoNegocio>(),
      supabase
        .schema("soma")
        .from("processo_parte")
        .select("nm_parte, tp_lado, nr_ordem")
        .eq("cd_processo", id)
        .in("tp_lado", ["vendedor", "comprador"])
        .order("nr_ordem")
        .returns<{ nm_parte: string; tp_lado: "vendedor" | "comprador"; nr_ordem: number }[]>(),
    ]);

  if (!processo) {
    notFound();
  }

  const cidades =
    cidadesDb && cidadesDb.length > 0 ? cidadesDb.map((c) => c.nm_cidade) : CIDADES_SERVICO_PADRAO;

  // Cidade do cartório do imóvel (ex: "salvador-3" -> Salvador), se estiver
  // entre as cidades do orçamento.
  const semAcento = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const cartorio = CARTORIOS_IMOVEIS.find((c) => c.codigo === negocio?.ds_imovel_cartorio);
  const cidadeDoImovel = cartorio
    ? cidades.find((c) => semAcento(c) === semAcento(cartorio.rotulo.split(" — ")[0]))
    : undefined;

  const dadosContrato = negocio
    ? {
        valorImovel: negocio.vl_imovel != null ? String(negocio.vl_imovel) : "",
        inscricaoMunicipal: negocio.ds_imovel_iptu ?? "",
        cidade: cidadeDoImovel ?? "",
        resumo: {
          vendedores: (partes ?? []).filter((x) => x.tp_lado === "vendedor").map((x) => x.nm_parte),
          compradores: (partes ?? []).filter((x) => x.tp_lado === "comprador").map((x) => x.nm_parte),
          endereco: negocio.ds_imovel_endereco,
          matricula: negocio.ds_imovel_matricula,
          formaPagamento: negocio.tp_pagamento,
          banco: negocio.ds_banco,
        },
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
        {qtdOrcamentos ? "Orçamento complementar" : "Novo orçamento"} — Processo{" "}
        {processo.ds_numero_processo}
      </h1>
      <OrcamentoComplementarForm
        cdProcesso={id}
        tpProcesso={processo.tp_processo}
        servicos={servicos ?? []}
        custas={custas ?? []}
        cidades={cidades}
        pacoteItens={pacoteItens ?? []}
        dadosContrato={dadosContrato}
      />
    </div>
  );
}
