import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUsuarioAtual } from "@/lib/auth";
import { getSiteUrl } from "@/lib/mercadopago";
import { carregarPartesAnteriores } from "@/lib/partes-anteriores";
import { createClient } from "@/lib/supabase/server";
import type {
  Corretor,
  Imobiliaria,
  ProcessoCorretor,
  ProcessoNegocio,
  ProcessoParte,
} from "@/types/database";
import type { NegocioInput, ParteInput } from "../../novo/actions";
import {
  ProcessoForm,
  type CorretorLinha,
  type InicialProcessoForm,
} from "../../novo/processo-form";
import { exigirProcessoContrato } from "../processo-dados";

const PODE_EDITAR = new Set(["master", "juridico"]);

const texto = (v: string | null | undefined) => v ?? "";
const numero = (v: number | null | undefined) => (v == null ? "" : String(v));
const simNao = (v: boolean | null | undefined) => (v == null ? "" : v ? "true" : "false");

const PARTE_EM_BRANCO = {
  cd_parte: "",
  nr_ordem: 0,
  nm_parte: "",
  tp_lado: "vendedor",
} as ProcessoParte;

function parteParaForm(p: ProcessoParte): ParteInput {
  return {
    cd_parte: p.cd_parte || undefined,
    tp_lado: p.tp_lado,
    nr_ordem: p.nr_ordem,
    nm_parte: p.nm_parte,
    ds_telefone: texto(p.ds_telefone),
    ds_email: texto(p.ds_email),
    ds_profissao: texto(p.ds_profissao),
    ds_conta_bancaria: texto(p.ds_conta_bancaria),
    ds_documentos_obs: texto(p.ds_documentos_obs),
    ds_cpf: texto(p.ds_cpf),
    ds_rg: texto(p.ds_rg),
    dt_nascimento: texto(p.dt_nascimento).slice(0, 10),
    ds_endereco: texto(p.ds_endereco),
    tp_vinculo: p.tp_vinculo ?? "",
    ds_nire: texto(p.ds_nire),
    ds_tipo_societario: texto(p.ds_tipo_societario),
    ds_representacao: (p.ds_representacao as "conjunta" | "isolada" | null) ?? "",
    docs: [],
    modo: "manual",
  };
}

export default async function EditarProcessoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const usuario = await getUsuarioAtual();
  if (!PODE_EDITAR.has(usuario.tp_role)) redirect(`/processos/${id}`);

  const processo = await exigirProcessoContrato(id);
  const supabase = await createClient();

  const [
    { data: imobiliarias },
    { data: corretoresCadastro },
    { data: partes },
    { data: negocio },
    { data: corretoresDoProcesso },
    partesAnteriores,
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
      .from("corretores")
      .select("*")
      .eq("sn_ativo", true)
      .order("nm_corretor")
      .returns<Corretor[]>(),
    supabase
      .schema("soma")
      .from("processo_parte")
      .select("*")
      .eq("cd_processo", id)
      .neq("tp_lado", "corretor")
      .order("nr_ordem")
      .returns<ProcessoParte[]>(),
    supabase
      .schema("soma")
      .from("processo_negocio")
      .select("*")
      .eq("cd_processo", id)
      .maybeSingle<ProcessoNegocio>(),
    supabase
      .schema("soma")
      .from("processo_corretor")
      .select("*")
      .eq("cd_processo", id)
      .order("nr_ordem")
      .returns<ProcessoCorretor[]>(),
    carregarPartesAnteriores(supabase),
  ]);

  const todas = (partes ?? []).map(parteParaForm);
  // Processo sem nenhuma parte do lado: o formulário abre com uma linha em branco.
  const doLado = (lado: "vendedor" | "comprador"): ParteInput[] => {
    const lista = todas.filter((p) => p.tp_lado === lado);
    return lista.length > 0 ? lista : [{ ...parteParaForm(PARTE_EM_BRANCO), tp_lado: lado, nm_parte: "" }];
  };

  const cadastro = new Map((corretoresCadastro ?? []).map((c) => [c.cd_corretor, c]));
  const corretores: CorretorLinha[] = (corretoresDoProcesso ?? []).map((c) => {
    const cad = c.cd_corretor ? cadastro.get(c.cd_corretor) : undefined;
    return {
      base: c.vl_honorario == null && c.pc_honorario != null ? "percentual" : "valor",
      cd_corretor: texto(c.cd_corretor),
      nm_corretor: c.nm_corretor,
      vl_honorario: numero(c.vl_honorario),
      pc_honorario: numero(c.pc_honorario),
      ds_lado: texto(c.ds_lado),
      ds_cpf: texto(cad?.ds_cpf),
      ds_creci: texto(cad?.ds_creci),
      ds_pix: texto(cad?.ds_pix),
      ds_telefone: texto(cad?.ds_telefone),
      ds_email: texto(cad?.ds_email),
      dt_nascimento: texto(cad?.dt_nascimento).slice(0, 10),
    };
  });

  const n = negocio;
  const negocioForm: NegocioInput = {
    vl_imovel: numero(n?.vl_imovel),
    vl_entrada: numero(n?.vl_entrada),
    vl_financiamento: numero(n?.vl_financiamento),
    ds_banco: texto(n?.ds_banco),
    sn_possui_inquilino: simNao(n?.sn_possui_inquilino),
    sn_ocupado: simNao(n?.sn_ocupado),
    ds_entrega_chaves: texto(n?.ds_entrega_chaves),
    sn_imovel_financiado: simNao(n?.sn_imovel_financiado),
    ds_prazo_financiamento: texto(n?.ds_prazo_financiamento),
    ds_itens_imovel: texto(n?.ds_itens_imovel),
    ds_imovel_endereco: texto(n?.ds_imovel_endereco),
    ds_imovel_matricula: texto(n?.ds_imovel_matricula),
    ds_imovel_iptu: texto(n?.ds_imovel_iptu),
    ds_imovel_descricao: texto(n?.ds_imovel_descricao),
    ds_imovel_cartorio: texto(n?.ds_imovel_cartorio),
    tp_pagamento: n?.tp_pagamento ?? "",
    vl_sinal: numero(n?.vl_sinal),
    sn_usa_fgts: simNao(n?.sn_usa_fgts),
    vl_fgts: numero(n?.vl_fgts),
    vl_saldo_quitacao: numero(n?.vl_saldo_quitacao),
    vl_honorarios_total: numero(n?.vl_honorarios_total),
    pc_honorarios_total: numero(n?.pc_honorarios_total),
    ds_honorarios_quando: texto(n?.ds_honorarios_quando),
    vl_honorarios_imobiliaria: numero(n?.vl_honorarios_imobiliaria),
    pc_honorarios_imobiliaria: numero(n?.pc_honorarios_imobiliaria),
  };

  const inicial: InicialProcessoForm = {
    cd_imobiliaria: texto(processo.cd_imobiliaria),
    nm_solicitante: texto(processo.nm_comprador_convidado),
    ds_telefone: texto(processo.ds_telefone_comprador_convidado),
    vendedores: doLado("vendedor"),
    compradores: doLado("comprador"),
    outrasPartes: todas.filter((p) => p.tp_lado !== "vendedor" && p.tp_lado !== "comprador"),
    corretores,
    negocio: negocioForm,
    baseTotal: n?.vl_honorarios_total == null && n?.pc_honorarios_total != null ? "percentual" : "valor",
    baseImobiliaria:
      n?.vl_honorarios_imobiliaria == null && n?.pc_honorarios_imobiliaria != null
        ? "percentual"
        : "valor",
    imobiliariaParticipa:
      n?.vl_honorarios_imobiliaria != null || n?.pc_honorarios_imobiliaria != null,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link
          href={`/processos/${id}`}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao processo
        </Link>
        <h2 className="font-serif-doc text-xl font-semibold text-foreground">
          Editar dados do processo
        </h2>
      </div>
      <ProcessoForm
        imobiliarias={imobiliarias ?? []}
        corretoresCadastro={corretoresCadastro ?? []}
        partesAnteriores={partesAnteriores}
        siteUrl={getSiteUrl()}
        edicao={{ cdProcesso: id, inicial }}
      />
    </div>
  );
}
