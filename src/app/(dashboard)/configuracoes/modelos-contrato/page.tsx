import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ModeloContrato } from "@/types/database";
import { ModelosLista } from "./modelos-lista";
import { NovoModelo } from "./novo-modelo";

// Leitura pro time interno (mesma RLS da migration 043); edição só
// Jurídico e Master.
const PODE_VER = new Set(["master", "juridico", "gerente", "despachante"]);

export default async function ModelosContratoPage() {
  const usuario = await getUsuarioAtual();
  if (!PODE_VER.has(usuario.tp_role)) {
    redirect("/dashboard");
  }

  const editavel = usuario.tp_role === "master" || usuario.tp_role === "juridico";

  const supabase = await createClient();
  const { data: modelos } = await supabase
    .schema("soma")
    .from("modelos_contrato")
    .select("*")
    .order("nm_modelo")
    .returns<ModeloContrato[]>();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Textos-base de contrato. O Jurídico monta e versiona aqui; a partir de um modelo ativo, a
        minuta de um processo de contrato é gerada com os dados já preenchidos.
        {editavel
          ? " Alterar o texto de um modelo sobe uma versão nova."
          : " Você tem acesso de leitura — abra um modelo pra revisar o texto."}
      </p>
      {editavel && <NovoModelo />}
      <ModelosLista modelos={modelos ?? []} editavel={editavel} />
    </div>
  );
}
