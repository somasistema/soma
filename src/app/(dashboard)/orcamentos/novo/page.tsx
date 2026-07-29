import { createClient } from "@/lib/supabase/server";
import type { Imobiliaria, ServicoComPrecos, TabelaCustaItem } from "@/types/database";
import { OrcamentoForm } from "./orcamento-form";

export default async function NovoOrcamentoPage() {
  const supabase = await createClient();

  const [{ data: imobiliarias }, { data: servicos }, { data: custas }] = await Promise.all([
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
      .select("*, servico_precos(*)")
      .eq("sn_ativo", true)
      .order("nm_categoria")
      .order("nm_servico")
      .returns<ServicoComPrecos[]>(),
    supabase
      .schema("soma")
      .from("tabela_custas")
      .select("*")
      .order("tp_tabela")
      .order("nr_ordem")
      .returns<TabelaCustaItem[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">Novo orçamento</h1>
      <OrcamentoForm
        imobiliarias={imobiliarias ?? []}
        servicos={servicos ?? []}
        custas={custas ?? []}
      />
    </div>
  );
}
