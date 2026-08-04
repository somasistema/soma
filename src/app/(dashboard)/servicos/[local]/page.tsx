import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CIDADES_SERVICO_PADRAO,
  LOCAIS_SERVICO,
  LOCAL_SERVICO_LABEL,
  type Cidade,
  type LocalServico,
  type ServicoComPrecos,
} from "@/types/database";
import { ServicoForm } from "../servico-form";
import { ServicosTabela } from "./servicos-tabela";

export default async function ServicosLocalPage({
  params,
}: {
  params: Promise<{ local: string }>;
}) {
  const { local: localParam } = await params;
  const local = localParam.toUpperCase() as LocalServico;

  if (!LOCAIS_SERVICO.includes(local)) {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: servicos }, { data: cidadesDb }] = await Promise.all([
    supabase
      .schema("soma")
      .from("servicos")
      .select("*, servico_precos(*)")
      .eq("tp_local", local)
      .order("nm_categoria")
      .order("nm_servico")
      .returns<ServicoComPrecos[]>(),
    supabase
      .schema("soma")
      .from("cidades")
      .select("*")
      .eq("sn_ativo", true)
      .order("nr_ordem")
      .returns<Cidade[]>(),
  ]);

  const cidades =
    cidadesDb && cidadesDb.length > 0 ? cidadesDb.map((c) => c.nm_cidade) : CIDADES_SERVICO_PADRAO;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{LOCAL_SERVICO_LABEL[local]}</p>
      <ServicoForm local={local} cidades={cidades} />
      <ServicosTabela servicos={servicos ?? []} cidades={cidades} />
    </div>
  );
}
