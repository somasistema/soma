import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Processo, Servico } from "@/types/database";
import { OrcamentoComplementarForm } from "./orcamento-complementar-form";

export default async function OrcamentoComplementarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: processo }, { data: servicos }] = await Promise.all([
    supabase.schema("soma").from("processos").select("*").eq("cd_processo", id).single<Processo>(),
    supabase
      .schema("soma")
      .from("servicos")
      .select("*")
      .eq("sn_ativo", true)
      .order("nm_servico")
      .returns<Servico[]>(),
  ]);

  if (!processo) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
        Orçamento complementar — Processo {processo.ds_numero_processo}
      </h1>
      <OrcamentoComplementarForm cdProcesso={id} servicos={servicos ?? []} />
    </div>
  );
}
