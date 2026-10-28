import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Logo } from "@/components/logo";
import { createPublicClient } from "@/lib/supabase/public";
import { PAPEL_APROVACAO_LABEL, type TipoPapelAprovacao } from "@/types/database";
import { DecisaoForm } from "./decisao-form";

// Página pessoal: não aparece em buscas.
export const metadata: Metadata = {
  title: "Minuta do contrato — SOMA",
  robots: { index: false, follow: false },
};

type ConviteMinuta = {
  nm_destinatario: string;
  tp_papel: TipoPapelAprovacao;
  tp_status: "pendente" | "aprovada" | "reprovada";
  ds_comentario: string | null;
  ds_numero_processo: string;
  nr_versao: number;
  tp_status_minuta: "em_aprovacao" | "aprovada" | "reprovada";
  versao_atual: boolean;
  pode_decidir: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AprovarMinutaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID.test(token)) notFound();

  // Página pública, sem sessão — client anon + RPC SECURITY DEFINER que
  // resolve o convite pelo próprio token.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .schema("soma")
    .rpc("fn_minuta_convite_por_token", { p_token: token });
  if (error) throw new Error(`Não foi possível consultar o link: ${error.message}`);

  const convite = data as ConviteMinuta | null;
  if (!convite) notFound();

  const primeiroNome = convite.nm_destinatario.trim().split(/\s+/)[0];
  const papel = PAPEL_APROVACAO_LABEL[convite.tp_papel] ?? convite.tp_papel;
  const urlPdf = `/aprovar/${token}/pdf`;

  return (
    <div className="flex min-h-screen justify-center bg-muted px-4 py-10">
      <FadeIn className="flex w-full max-w-3xl flex-col gap-6">
        <div>
          <Logo size="sm" className="mb-3 items-start" />
          <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
            Olá, {primeiroNome}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta é a minuta do contrato do processo{" "}
            <strong className="text-foreground">{convite.ds_numero_processo}</strong> (versão{" "}
            {convite.nr_versao}), para a sua conferência como{" "}
            <strong className="text-foreground">{papel}</strong>.
          </p>
        </div>

        <section className="flex flex-col gap-3 rounded-radius border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Leia a minuta</h2>
            <a
              href={urlPdf}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand underline"
            >
              Abrir em tela cheia / baixar
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
          <iframe
            src={urlPdf}
            title="Minuta do contrato"
            className="h-[70vh] w-full rounded-radius border border-border bg-white"
          />
          <p className="text-xs text-muted-foreground">
            Se o PDF não aparecer aqui (acontece em alguns celulares), use o link acima para abrir.
          </p>
        </section>

        <section className="rounded-radius border border-border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold text-foreground">Sua resposta</h2>

          {convite.pode_decidir ? (
            <div className="flex flex-col gap-3">
              {convite.tp_status_minuta === "reprovada" && (
                <p className="text-sm text-muted-foreground">
                  Outra parte já recusou esta minuta e a equipe está ajustando. Mesmo assim, você
                  pode aceitar ou recusar: a sua resposta fica registrada e você receberá um novo
                  link quando houver uma nova versão.
                </p>
              )}
              <DecisaoForm token={token} />
            </div>
          ) : convite.tp_status === "aprovada" ? (
            <p className="flex items-start gap-2 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-aceito" />
              Você aceitou esta minuta. Obrigado! Avisaremos sobre os próximos passos (assinatura
              digital).
            </p>
          ) : convite.tp_status === "reprovada" ? (
            <div className="flex flex-col gap-1 text-sm text-foreground">
              <p className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-status-reprovado" />
                Você recusou esta minuta. A equipe vai ajustar e, se houver uma nova versão, você
                receberá outro link.
              </p>
              {convite.ds_comentario && (
                <p className="ml-6 text-muted-foreground">Motivo informado: {convite.ds_comentario}</p>
              )}
            </div>
          ) : !convite.versao_atual ? (
            <p className="text-sm text-muted-foreground">
              Esta versão da minuta foi substituída por uma mais nova. Procure o e-mail mais recente
              da SOMA com o novo link.
            </p>
          ) : convite.tp_status_minuta === "reprovada" ? (
            <p className="text-sm text-muted-foreground">
              Esta minuta foi recusada por uma das partes e está sendo ajustada pela equipe. Você
              receberá um novo link quando houver uma nova versão.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Esta minuta não está mais aguardando a sua resposta.
            </p>
          )}
        </section>
      </FadeIn>
    </div>
  );
}
