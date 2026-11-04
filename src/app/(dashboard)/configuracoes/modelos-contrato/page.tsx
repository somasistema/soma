import { Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button-variants";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { ModeloContrato } from "@/types/database";
import { ModelosLista } from "./modelos-lista";

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-serif-doc text-xl font-semibold text-foreground">Modelos de contrato</h2>
          <p className="text-sm text-muted-foreground">
            Textos-base de contrato. A minuta de cada processo nasce de um modelo ativo, já com os dados
            preenchidos.
            {editavel
              ? " Alterar o texto sobe uma versão nova e a anterior fica guardada."
              : " Você tem acesso de leitura — abra um modelo para revisar o texto."}
          </p>
        </div>
        {editavel && (
          <Link
            href="/configuracoes/modelos-contrato/novo"
            className={cn(buttonVariants({ variant: "default" }), "gap-1.5 font-bold")}
          >
            <Plus className="h-4 w-4" />
            Novo modelo
          </Link>
        )}
      </div>
      <ModelosLista modelos={modelos ?? []} editavel={editavel} />
    </div>
  );
}
