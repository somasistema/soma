import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { getSiteUrl } from "@/lib/mercadopago";
import { carregarPartesAnteriores } from "@/lib/partes-anteriores";
import { createClient } from "@/lib/supabase/server";
import type { Corretor, Imobiliaria } from "@/types/database";
import { ProcessoForm } from "./processo-form";

// A leitura dos documentos anexados (OCR + IA) roda em server action.
export const maxDuration = 60;

const PODE_CRIAR_PROCESSO = new Set(["master", "juridico"]);

export default async function NovoProcessoPage() {
  const usuario = await getUsuarioAtual();
  if (!PODE_CRIAR_PROCESSO.has(usuario.tp_role)) {
    redirect("/processos");
  }

  const supabase = await createClient();

  const [{ data: imobiliarias }, { data: corretores }, partesAnteriores] =
    await Promise.all([
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
      carregarPartesAnteriores(supabase),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
        Novo processo (Contrato)
      </h1>
      <ProcessoForm
        imobiliarias={imobiliarias ?? []}
        corretoresCadastro={corretores ?? []}
        partesAnteriores={partesAnteriores}
        siteUrl={getSiteUrl()}
      />
    </div>
  );
}
