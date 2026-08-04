import { createClient } from "@/lib/supabase/server";
import type { Cidade } from "@/types/database";
import { CidadeForm } from "./cidade-form";
import { CidadesLista } from "./cidades-lista";

export default async function CidadesPage() {
  const supabase = await createClient();

  const { data: cidades } = await supabase
    .schema("soma")
    .from("cidades")
    .select("*")
    .order("nr_ordem")
    .returns<Cidade[]>();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Cidades disponíveis nos formulários de orçamento e no cadastro de preço de serviços.
        Desativar/excluir uma cidade não apaga preços já cadastrados pra ela.
      </p>
      <CidadeForm />
      <CidadesLista cidades={cidades ?? []} />
    </div>
  );
}
