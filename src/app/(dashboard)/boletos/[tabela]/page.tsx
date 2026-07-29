import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  TABELA_CUSTA_LABEL,
  TABELAS_CUSTA,
  type TabelaCusta,
  type TabelaCustaItem,
} from "@/types/database";
import { TabelaCustasLista } from "./tabela-custas-lista";

export default async function BoletoTabelaPage({
  params,
}: {
  params: Promise<{ tabela: string }>;
}) {
  const { tabela: tabelaParam } = await params;
  const tabela = tabelaParam.toUpperCase() as TabelaCusta;

  if (!TABELAS_CUSTA.includes(tabela)) {
    notFound();
  }

  const supabase = await createClient();
  const { data: custas } = await supabase
    .schema("soma")
    .from("tabela_custas")
    .select("*")
    .eq("tp_tabela", tabela)
    .order("nr_ordem")
    .returns<TabelaCustaItem[]>();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">{TABELA_CUSTA_LABEL[tabela]}</p>
      <TabelaCustasLista itens={custas ?? []} />
    </div>
  );
}
