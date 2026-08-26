import { XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { Logo } from "@/components/logo";
import { cn, formatarMoeda } from "@/lib/utils";
import { WhatsappDemoChat } from "./whatsapp-demo-chat";

const ESCOPO = [
  {
    titulo: "Canal",
    tag: "2.1",
    itens: ["Conexão a um número de WhatsApp Business via Z-api"],
  },
  {
    titulo: "Interface de atendimento",
    tag: "2.4",
    itens: [
      "Nova aba no dashboard, com conversas atribuídas a cada perfil",
      "Histórico completo, incluindo a triagem feita pela IA antes do handoff",
      "Resposta enviada direto pelo sistema — sem abrir o WhatsApp Business à parte",
    ],
  },
  {
    titulo: "Vínculo com processo",
    tag: "2.5 · opcional",
    itens: [
      "Associar a conversa a um processo específico (ex: SOMA-2026-0001)",
      "Atendimento mantido no contexto do caso",
    ],
  },
];

const FORA_DE_ESCOPO = [
  "Atendimento automático para o Comprador na página pública de aceite",
  "Múltiplos números de WhatsApp ou múltiplas instâncias",
  "Fluxo de qualificação de leads de vendas (diferente do suporte interno a processo)",
];

const STACK = [
  { nome: "Z-api — conexão WhatsApp", cor: "bg-[#1F9E56]" },
  { nome: "n8n — orquestração do agente", cor: "bg-brand" },
  { nome: "API da Claude — triagem por IA", cor: "bg-accent" },
  { nome: "Integração direta com o schema soma.* já existente", cor: "bg-muted-foreground" },
];

const FASES = [
  {
    numero: 1,
    titulo: "Conexão WhatsApp + agente de triagem",
    descricao:
      "Número conectado via Z-api; agente em n8n/Claude API identifica o assunto e decide se resolve ou transfere.",
    prazo: "7 dias úteis",
    valor: 950,
  },
  {
    numero: 2,
    titulo: "Inbox de atendimento no dashboard",
    descricao:
      "Conversas por perfil (Jurídico / Imobiliária / Despachante), histórico completo e handoff.",
    prazo: "7 dias úteis",
    valor: 950,
  },
  {
    numero: 3,
    titulo: "Vínculo com processo + ajustes finais",
    descricao:
      "Associação opcional de conversa a um processo (ex: SOMA-2026-0001) e polimento geral.",
    prazo: "4 dias úteis",
    valor: 500,
  },
];

const PRAZO_TOTAL = "18 dias úteis";
const VALOR_TOTAL = FASES.reduce((soma, fase) => soma + fase.valor, 0);

export default function PropostaWhatsappPage() {
  return (
    <div className="flex min-h-screen justify-center bg-muted px-4 py-12">
      <FadeIn className="flex w-full max-w-4xl flex-col gap-6">
        <Logo size="lg" className="self-center" />

        <div className="overflow-hidden rounded-2xl border border-border bg-brand text-brand-foreground shadow-sm">
          <div className="flex flex-col gap-4 p-8 sm:p-10">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
                Orçamento complementar
              </p>
              <h1 className="mt-3 font-serif-doc text-3xl font-semibold text-brand-foreground sm:text-4xl">
                Canal de Atendimento via WhatsApp
              </h1>
              <p className="mt-2 max-w-2xl text-brand-foreground/70 italic">
                Triagem por IA com handoff para o time interno — mesmo modelo já validado no App
                ALFA (Advocacia Piran)
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-xs text-brand-foreground/60">
              <span>
                <strong className="font-semibold text-brand-foreground/90">Cliente</strong> — Marcos
                José de Oliveira &amp; Leonardo dos Santos Barbosa
              </span>
              <span>
                <strong className="font-semibold text-brand-foreground/90">Desenvolvedor</strong> —
                Gustavo Ribeiro, Inova Simples
              </span>
              <span>
                <strong className="font-semibold text-brand-foreground/90">Ref.</strong> Contrato
                original — Plataforma SOMA, Fase 1 (13/07/2026)
              </span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Contexto</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Este orçamento complementar atende à solicitação de um canal de atendimento via
              WhatsApp integrado à plataforma SOMA. Um agente de inteligência artificial faz a
              triagem inicial de cada conversa, e a equipe interna assume o atendimento sempre que o
              assunto exigir uma pessoa — sem trocar de ferramenta, direto de dentro do sistema que
              já usam.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Escopo funcional</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {ESCOPO.map((bloco) => (
                <div key={bloco.titulo} className="rounded-radius border border-border bg-muted/50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{bloco.titulo}</h3>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                      {bloco.tag}
                    </span>
                  </div>
                  <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                    {bloco.itens.map((item) => (
                      <li key={item} className="flex gap-1.5">
                        <span className="text-accent">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Triagem por IA e transferência (handoff) — 2.2 / 2.3
              </p>
              <WhatsappDemoChat />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Fora de escopo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <ul className="flex flex-col gap-2">
              {FORA_DE_ESCOPO.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs italic text-muted-foreground/70">
              Itens acima podem virar um orçamento complementar futuro, caso haja interesse.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>4. Stack técnica</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {STACK.map((item) => (
                <span
                  key={item.nome}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3.5 py-1.5 text-sm text-foreground"
                >
                  <span className={cn("h-2 w-2 rounded-full", item.cor)} />
                  {item.nome}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>5. Fases, prazos e investimento</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0">
            {FASES.map((fase, i) => (
              <div
                key={fase.numero}
                className={cn(
                  "flex flex-col gap-3 py-5 sm:flex-row sm:items-start sm:gap-5",
                  i > 0 && "border-t border-border"
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-accent font-serif-doc text-base font-semibold text-accent">
                  {fase.numero}
                </span>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-foreground">{fase.titulo}</h3>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">{fase.descricao}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                  <span className="text-xs text-muted-foreground/70">{fase.prazo}</span>
                  <span className="font-serif-doc text-sm font-semibold text-foreground">
                    {formatarMoeda(fase.valor)}
                  </span>
                </div>
              </div>
            ))}

            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Total</h3>
                <span className="text-xs text-muted-foreground/70">{PRAZO_TOTAL}</span>
              </div>
              <span className="font-serif-doc text-xl font-semibold text-accent">
                {formatarMoeda(VALOR_TOTAL)}
              </span>
            </div>

            <div className="mt-4 rounded-r-lg border-l-[3px] border-accent bg-accent/10 px-4 py-3 text-sm text-muted-foreground">
              <strong className="text-foreground">Investimento total: {formatarMoeda(VALOR_TOTAL)}.</strong>{" "}
              Estrutura de pagamento sugerida: {formatarMoeda(FASES[0].valor)} na assinatura,{" "}
              {formatarMoeda(FASES[1].valor)} na entrega da Fase 2 e {formatarMoeda(FASES[2].valor)}{" "}
              na entrega final, seguindo o mesmo modelo do contrato original.
            </div>
          </CardContent>
        </Card>

        <p className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-muted-foreground/70">
          <span>Gustavo Ribeiro Desenvolvimento — Inova Simples (I.S.)</span>
          <span>Documento gerado em 22/08/2026 · Uso interno</span>
        </p>
      </FadeIn>
    </div>
  );
}
