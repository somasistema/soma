import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getUsuarioAtual } from "@/lib/auth";
import { estadoDaIntegracao, INTEGRACOES, type EstadoIntegracao, type Integracao } from "@/lib/integracoes";
import { cn } from "@/lib/utils";
import { TesteIntegracao } from "./teste-integracao";

// Lê variáveis de ambiente a cada acesso: nada de cache estático.
export const dynamic = "force-dynamic";

function selo(i: Integracao, e: EstadoIntegracao): { texto: string; classe: string } {
  if (i.situacao === "planejada") return { texto: "Planejada", classe: "bg-muted-foreground/15 text-muted-foreground" };
  if (e.configurada) return { texto: i.variaveis.length === 0 ? "Ativa" : "Configurada", classe: "bg-status-aceito/15 text-status-aceito" };
  if (i.opcional) return { texto: "Desligada", classe: "bg-status-pendente/15 text-status-pendente" };
  return { texto: "Falta configurar", classe: "bg-status-reprovado/15 text-status-reprovado" };
}

function CartaoIntegracao({ integracao, estado }: { integracao: Integracao; estado: EstadoIntegracao }) {
  const s = selo(integracao, estado);
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{integracao.nome}</p>
            <p className="text-xs text-muted-foreground">{integracao.categoria}</p>
          </div>
          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", s.classe)}>{s.texto}</span>
        </div>

        <p className="text-sm text-foreground">{integracao.usoNoSistema}</p>

        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Custo</dt>
          <dd className="text-foreground">{integracao.custo}</dd>
          {integracao.variaveis.length > 0 && (
            <>
              <dt className="text-muted-foreground">Variáveis</dt>
              <dd className="flex flex-wrap gap-1">
                {integracao.variaveis.map((v) => {
                  const falta = estado.faltando.includes(v);
                  return (
                    <code
                      key={v}
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-[11px]",
                        falta ? "bg-status-reprovado/10 text-status-reprovado" : "bg-muted text-foreground"
                      )}
                      title={falta ? "Não configurada" : "Configurada"}
                    >
                      {v}
                    </code>
                  );
                })}
              </dd>
            </>
          )}
        </dl>

        {estado.avisos.map((a) => (
          <p key={a} className="rounded-radius border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
            {a}
          </p>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {integracao.testavel ? (
            <TesteIntegracao id={integracao.id} podeTestar={integracao.situacao === "planejada" || estado.configurada} />
          ) : (
            <span className="text-xs text-muted-foreground">Sem teste automático.</span>
          )}
          {integracao.site && (
            <a
              href={integracao.site}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-brand underline underline-offset-2"
            >
              Abrir site
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function IntegracoesPage() {
  const usuario = await getUsuarioAtual();
  if (usuario.tp_role !== "master") redirect("/configuracoes");

  const itens = INTEGRACOES.map((i) => ({ integracao: i, estado: estadoDaIntegracao(i) }));
  const emUso = itens.filter((x) => x.integracao.situacao === "em_uso");
  const planejadas = itens.filter((x) => x.integracao.situacao === "planejada");
  const comProblema = emUso.filter((x) => !x.estado.configurada && !x.integracao.opcional).length;
  const desligadas = emUso.filter((x) => !x.estado.configurada && x.integracao.opcional).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">
          Serviços externos que o SOMA usa, com o que cada um faz, quanto custa e se está configurado neste ambiente. O
          teste de conexão só faz consultas que não cobram. Os valores das chaves nunca aparecem aqui.
        </p>
        <p className="text-sm font-medium text-foreground">
          {comProblema === 0
            ? "Todas as integrações obrigatórias estão configuradas."
            : `${comProblema} integração(ões) obrigatória(s) sem configuração.`}
          {desligadas > 0 && (
            <span className="font-normal text-muted-foreground"> {desligadas} opcional(is) desligada(s).</span>
          )}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif-doc text-lg font-semibold text-foreground">Em uso</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {emUso.map(({ integracao, estado }) => (
            <CartaoIntegracao key={integracao.id} integracao={integracao} estado={estado} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-serif-doc text-lg font-semibold text-foreground">Planejadas (Fase 3)</h2>
        <p className="text-sm text-muted-foreground">
          Ainda não ligadas ao sistema: dependem de conta, chave e, em alguns casos, contrato do cliente.
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {planejadas.map(({ integracao, estado }) => (
            <CartaoIntegracao key={integracao.id} integracao={integracao} estado={estado} />
          ))}
        </div>
      </section>
    </div>
  );
}
