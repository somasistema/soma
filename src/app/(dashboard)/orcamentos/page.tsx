import { FileText } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import { formatarData, formatarMoeda } from "@/lib/utils";
import type { Orcamento, Processo } from "@/types/database";

type OrcamentoComProcesso = Orcamento & {
  processos: Pick<Processo, "ds_numero_processo" | "nm_comprador_convidado"> | null;
};

export default async function OrcamentosPage() {
  const supabase = await createClient();

  const { data: orcamentos } = await supabase
    .schema("soma")
    .from("orcamentos")
    .select("*, processos(ds_numero_processo, nm_comprador_convidado)")
    .order("ts_criacao", { ascending: false })
    .returns<OrcamentoComProcesso[]>();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif-doc text-2xl font-semibold text-foreground">Orçamentos</h1>
        <Link href="/orcamentos/novo" className={buttonVariants({ variant: "default" })}>
          Novo orçamento
        </Link>
      </div>

      {orcamentos && orcamentos.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Processo</th>
                <th className="px-4 py-3 font-medium">Comprador</th>
                <th className="px-4 py-3 font-medium">Criado em</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orcamentos.map((orcamento) => (
                <tr
                  key={orcamento.cd_orcamento}
                  className="border-t border-border hover:bg-muted/50"
                >
                  <td className="px-4 py-3">{orcamento.processos?.ds_numero_processo}</td>
                  <td className="px-4 py-3">{orcamento.processos?.nm_comprador_convidado}</td>
                  <td className="px-4 py-3">{formatarData(orcamento.ts_criacao)}</td>
                  <td className="px-4 py-3">{formatarMoeda(orcamento.vl_total_geral)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={orcamento.tp_status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orcamentos/${orcamento.cd_orcamento}`}
                      className="text-sm font-medium text-brand hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum orçamento criado ainda.</p>
          <Link href="/orcamentos/novo" className={buttonVariants({ variant: "default" })}>
            Novo orçamento
          </Link>
        </div>
      )}
    </div>
  );
}
