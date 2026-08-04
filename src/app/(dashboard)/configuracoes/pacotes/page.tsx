import { createClient } from "@/lib/supabase/server";
import { CIDADES_SERVICO_PADRAO } from "@/types/database";
import type { Cidade, PacoteItem, ServicoComPrecos, TabelaCustaItem } from "@/types/database";
import { PacoteForm } from "./pacote-form";
import { PacotesLista } from "./pacotes-lista";

export default async function PacotesPage() {
  const supabase = await createClient();

  const [{ data: servicos }, { data: custas }, { data: pacoteItens }, { data: cidadesDb }] =
    await Promise.all([
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
      supabase.schema("soma").from("pacote_itens").select("*").returns<PacoteItem[]>(),
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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Vincule boletos a um serviço — ao adicionar esse serviço num orçamento, os boletos
        vinculados entram junto automaticamente. Marcado como opcional, entra com &quot;(opcional)&quot; na
        descrição pra você decidir se remove naquele orçamento específico.
      </p>
      <PacoteForm servicos={servicos ?? []} custas={custas ?? []} cidades={cidades} />
      <PacotesLista
        pacoteItens={pacoteItens ?? []}
        servicos={servicos ?? []}
        custas={custas ?? []}
      />
    </div>
  );
}
