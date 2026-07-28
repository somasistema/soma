"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { OrcamentoPdf } from "@/lib/pdf/orcamento-pdf";
import type { Orcamento, OrcamentoServico, Processo } from "@/types/database";

export type GerarPdfState = { sucesso: true; url: string } | { sucesso: false; erro: string };

export async function gerarPdfOrcamento(cdOrcamento: string): Promise<GerarPdfState> {
  const supabase = await createClient();

  const { data: orcamento } = await supabase
    .schema("soma")
    .from("orcamentos")
    .select("*")
    .eq("cd_orcamento", cdOrcamento)
    .single<Orcamento>();

  if (!orcamento) {
    return { sucesso: false, erro: "Orçamento não encontrado." };
  }

  const [{ data: processo }, { data: itens }] = await Promise.all([
    supabase
      .schema("soma")
      .from("processos")
      .select("*")
      .eq("cd_processo", orcamento.cd_processo)
      .single<Processo>(),
    supabase
      .schema("soma")
      .from("orcamento_servicos")
      .select("*")
      .eq("cd_orcamento", cdOrcamento)
      .returns<OrcamentoServico[]>(),
  ]);

  if (!processo) {
    return { sucesso: false, erro: "Processo não encontrado." };
  }

  const buffer = await renderToBuffer(
    <OrcamentoPdf
      numeroProcesso={processo.ds_numero_processo}
      tipoProcesso={processo.tp_processo}
      nomeCidade={orcamento.nm_cidade}
      dataValidade={orcamento.dt_validade}
      nomeComprador={processo.nm_comprador_convidado}
      itens={itens ?? []}
      vlTotalHonorarios={orcamento.vl_total_honorarios}
      vlTotalCustas={orcamento.vl_total_custas}
      vlTotalGeral={orcamento.vl_total_geral}
    />
  );

  const caminho = `${cdOrcamento}.pdf`;

  const { error: erroUpload } = await supabase.storage
    .from("orcamentos-pdf")
    .upload(caminho, buffer, { contentType: "application/pdf", upsert: true });

  if (erroUpload) {
    return { sucesso: false, erro: erroUpload.message };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("orcamentos-pdf").getPublicUrl(caminho);

  const { error: erroUpdate } = await supabase
    .schema("soma")
    .from("orcamentos")
    .update({ ds_pdf_url: publicUrl })
    .eq("cd_orcamento", cdOrcamento);

  if (erroUpdate) {
    return { sucesso: false, erro: erroUpdate.message };
  }

  return { sucesso: true, url: publicUrl };
}
