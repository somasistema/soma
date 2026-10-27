import Link from "next/link";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/utils";
import type { Orcamento } from "@/types/database";

const PODE_CRIAR_ORCAMENTO = new Set(["master", "juridico"]);

export default async function OrcamentosDoProcessoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const { data: orcamentos } = await supabase
    .schema("soma")
    .from("orcamentos")
    .select("*")
    .eq("cd_processo", id)
    .order("ts_criacao", { ascending: false })
    .returns<Orcamento[]>();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Orçamentos</CardTitle>
        {PODE_CRIAR_ORCAMENTO.has(usuario.tp_role) && (
          <Link
            href={`/processos/${id}/orcamento-complementar`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {orcamentos && orcamentos.length > 0 ? "Novo orçamento complementar" : "Novo orçamento"}
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {orcamentos && orcamentos.length > 0 ? (
          orcamentos.map((orcamento) => (
            <Link
              key={orcamento.cd_orcamento}
              href={`/orcamentos/${orcamento.cd_orcamento}`}
              className="flex items-center justify-between rounded-radius border border-border p-3 hover:bg-muted/50"
            >
              <span className="text-sm text-foreground">
                {formatarData(orcamento.ts_criacao)} — {formatarMoeda(orcamento.vl_total_geral)}
              </span>
              <StatusBadge status={orcamento.tp_status} />
            </Link>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum orçamento para este processo.</p>
        )}
      </CardContent>
    </Card>
  );
}
