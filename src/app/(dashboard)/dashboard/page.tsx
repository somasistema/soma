import { FileText, Folder, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/utils";
import { ROLE_LABEL, TIPO_PROCESSO_LABEL, type Processo } from "@/types/database";

export default async function DashboardPage() {
  const usuario = await getUsuarioAtual();
  const ehMasterOuJuridico = usuario.tp_role === "master" || usuario.tp_role === "juridico";

  // RLS de soma.processos já restringe às linhas de cada perfil (comprador,
  // vendedor, corretor, despachante ou imobiliária) — não precisa filtrar
  // por auth.uid() aqui de novo.
  const supabase = await createClient();
  const { data: processos } = ehMasterOuJuridico
    ? { data: null }
    : await supabase
        .schema("soma")
        .from("processos")
        .select("*")
        .order("ts_criacao", { ascending: false })
        .limit(5)
        .returns<Processo[]>();

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <Card>
          <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/5 text-accent">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
                  Olá, {usuario.nm_usuario}
                </h1>
                <p className="mt-1 text-muted-foreground">
                  Você está conectado como {ROLE_LABEL[usuario.tp_role]}.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {ehMasterOuJuridico && (
                <Link href="/orcamentos" className={buttonVariants({ variant: "outline" }) + " gap-2"}>
                  <FileText className="h-4 w-4" />
                  Ver orçamentos
                </Link>
              )}
              <Link href="/processos" className={buttonVariants({ variant: "outline" }) + " gap-2"}>
                <Folder className="h-4 w-4" />
                Ver processos
              </Link>
            </div>
          </CardContent>
        </Card>
      </FadeIn>

      {!ehMasterOuJuridico && (
        <FadeIn delay={0.08}>
          <Card>
            <CardHeader>
              <CardTitle>Meus processos recentes</CardTitle>
            </CardHeader>
            <CardContent>
              {processos && processos.length > 0 ? (
                <StaggerList className="flex flex-col gap-2">
                  {processos.map((processo) => (
                    <StaggerItem key={processo.cd_processo}>
                      <Link
                        href={`/processos/${processo.cd_processo}`}
                        className="flex items-center justify-between rounded-radius border border-border p-3 transition-colors hover:bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {processo.ds_numero_processo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {TIPO_PROCESSO_LABEL[processo.tp_processo]}
                            {processo.nm_comprador_convidado ? ` — ${processo.nm_comprador_convidado}` : ""}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatarData(processo.ts_criacao)}</p>
                      </Link>
                    </StaggerItem>
                  ))}
                </StaggerList>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum processo vinculado ao seu usuário ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
