import { Folder } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerTableBody, StaggerRow } from "@/components/motion/stagger-list";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/utils";
import { TIPO_PROCESSO_LABEL, type Processo } from "@/types/database";

export default async function ProcessosPage() {
  const supabase = await createClient();

  // RLS já restringe às linhas que o usuário pode ver (Master/Jurídico
  // veem tudo; Despachante só os processos em que é responsável, etc).
  const { data: processos } = await supabase
    .schema("soma")
    .from("processos")
    .select("*")
    .order("ts_criacao", { ascending: false })
    .returns<Processo[]>();

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="font-serif-doc text-2xl font-semibold text-foreground">Processos</h1>
      </FadeIn>

      {processos && processos.length > 0 ? (
        <FadeIn delay={0.06} className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Criado em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <StaggerTableBody>
                {processos.map((processo) => (
                  <StaggerRow
                    key={processo.cd_processo}
                    className="border-t border-border transition-colors hover:bg-muted/50"
                  >
                    <td className="px-4 py-3">{processo.ds_numero_processo}</td>
                    <td className="px-4 py-3">{TIPO_PROCESSO_LABEL[processo.tp_processo]}</td>
                    <td className="px-4 py-3">{processo.nm_comprador_convidado ?? "—"}</td>
                    <td className="px-4 py-3">{formatarData(processo.ts_criacao)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/processos/${processo.cd_processo}`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        Ver detalhes
                      </Link>
                    </td>
                  </StaggerRow>
                ))}
              </StaggerTableBody>
            </table>
          </div>
        </FadeIn>
      ) : (
        <FadeIn className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border bg-card py-16 text-center">
          <Folder className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum processo encontrado.</p>
        </FadeIn>
      )}
    </div>
  );
}
