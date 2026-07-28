import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  LOCAIS_SERVICO,
  LOCAL_SERVICO_LABEL,
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
  const { data: servicos } = await supabase
    .schema("soma")
    .from("servicos")
    .select("*, servico_precos(*)")
    .eq("tp_local", local)
    .order("nm_categoria")
    .order("nm_servico")
    .returns<ServicoComPrecos[]>();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{LOCAL_SERVICO_LABEL[local]}</p>
      <ServicoForm local={local} />
      <ServicosTabela servicos={servicos ?? []} />
    </div>
  );
}
