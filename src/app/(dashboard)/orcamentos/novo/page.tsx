import { createClient } from "@/lib/supabase/server";
import type { Imobiliaria, Servico } from "@/types/database";
import { OrcamentoForm } from "./orcamento-form";

export default async function NovoOrcamentoPage() {
  const supabase = await createClient();

  const [{ data: imobiliarias }, { data: servicos }] = await Promise.all([
    supabase
      .schema("soma")
      .from("imobiliarias")
      .select("*")
      .eq("sn_ativo", true)
      .order("nm_imobiliaria")
      .returns<Imobiliaria[]>(),
    supabase
      .schema("soma")
      .from("servicos")
      .select("*")
      .eq("sn_ativo", true)
      .order("nm_servico")
      .returns<Servico[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">Novo orçamento</h1>
      <OrcamentoForm imobiliarias={imobiliarias ?? []} servicos={servicos ?? []} />
    </div>
  );
}
