import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NovoModeloFluxo } from "./novo-modelo-fluxo";

// Importar o .docx lê o arquivo no servidor.
export const maxDuration = 60;

export default async function NovoModeloPage() {
  const usuario = await getUsuarioAtual();
  if (usuario.tp_role !== "master" && usuario.tp_role !== "juridico") {
    redirect("/configuracoes/modelos-contrato");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .schema("soma")
    .from("modelos_contrato")
    .select("cd_modelo, nm_modelo")
    .order("nm_modelo")
    .returns<{ cd_modelo: string; nm_modelo: string }[]>();

  return <NovoModeloFluxo existentes={data ?? []} />;
}
