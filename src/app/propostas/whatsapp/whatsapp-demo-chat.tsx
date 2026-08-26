"use client";

import { useRef, useState } from "react";
import { MessageCircle, RotateCcw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Autor = "cliente" | "ia" | "sistema" | "juridico" | "imobiliaria" | "despachante";

interface Mensagem {
  id: number;
  autor: Autor;
  texto: string;
}

type Perfil = "juridico" | "imobiliaria" | "despachante";

const PERFIL_LABEL: Record<Perfil, string> = {
  juridico: "Jurídico",
  imobiliaria: "Imobiliária",
  despachante: "Despachante",
};

const AUTOR_LABEL: Record<Autor, string> = {
  cliente: "Cliente",
  ia: "Agente SOMA (IA)",
  sistema: "Sistema",
  juridico: "Jurídico",
  imobiliaria: "Imobiliária",
  despachante: "Despachante",
};

// Simulação por palavra-chave — na versão final quem classifica é a
// API da Claude via n8n. Regras aqui só existem pra dar um resultado
// coerente com as categorias descritas na proposta (2.2).
function classificar(
  textoOriginal: string
): { tipo: "resposta"; texto: string } | { tipo: "handoff"; perfil: Perfil; motivo: string } {
  const texto = textoOriginal.toLowerCase();

  if (/(status|andamento|atualiza[cç][aã]o|onde est[aá])/.test(texto)) {
    return {
      tipo: "resposta",
      texto:
        'O processo mencionado está em "Aguardando registro no cartório". Última atualização: ontem, 17h32. Posso ajudar em mais alguma coisa?',
    };
  }

  if (/(document|rg|cpf|comprovante|certid[aã]o|anexar|enviar arquivo)/.test(texto)) {
    return {
      tipo: "resposta",
      texto:
        "Você pode enviar o documento aqui mesmo pelo WhatsApp — eu já deixo anexado no processo pra equipe validar. Qual documento você vai mandar?",
    };
  }

  if (/(contrato|minuta|cl[aá]usula|jur[ií]dico|advogad)/.test(texto)) {
    return {
      tipo: "handoff",
      perfil: "juridico",
      motivo: "assunto envolve contrato/minuta — exige análise jurídica",
    };
  }

  if (/(pagamento|boleto|pix|fatura|comiss[aã]o|imobili[aá]ria)/.test(texto)) {
    return {
      tipo: "handoff",
      perfil: "imobiliaria",
      motivo: "assunto financeiro/comercial — encaminhado pra Imobiliária",
    };
  }

  if (/(cart[oó]rio|registro|averba[cç][aã]o|urgente|adiantar|amanh[aã]|hoje mesmo)/.test(texto)) {
    return {
      tipo: "handoff",
      perfil: "despachante",
      motivo: "pedido de prazo/execução em cartório — exige o Despachante",
    };
  }

  return {
    tipo: "handoff",
    perfil: "juridico",
    motivo: "assunto não reconhecido pela triagem — encaminhado por segurança",
  };
}

let proximoId = 1;

export function WhatsappDemoChat() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([
    {
      id: proximoId++,
      autor: "sistema",
      texto: "Converse com o agente da SOMA como se fosse um cliente real, pelo WhatsApp.",
    },
  ]);
  const [cdProcesso, setCdProcesso] = useState("");
  const [input, setInput] = useState("");
  const [respostaInbox, setRespostaInbox] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [handoffAtivo, setHandoffAtivo] = useState<{ perfil: Perfil; motivo: string } | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);

  function adicionar(autor: Autor, texto: string) {
    setMensagens((atual) => [...atual, { id: proximoId++, autor, texto }]);
    setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  function enviar() {
    const texto = input.trim();
    if (!texto || digitando) return;

    adicionar("cliente", texto);
    setInput("");

    // Se já tem handoff ativo, a mensagem só entra na conversa — quem
    // responde agora é o humano, não a IA de novo.
    if (handoffAtivo) return;

    setDigitando(true);
    setTimeout(() => {
      const resultado = classificar(texto);
      if (resultado.tipo === "resposta") {
        adicionar("ia", resultado.texto);
      } else {
        adicionar(
          "sistema",
          `↳ assunto exige intervenção humana — encaminhado ao ${PERFIL_LABEL[resultado.perfil]}`
        );
        setHandoffAtivo({ perfil: resultado.perfil, motivo: resultado.motivo });
      }
      setDigitando(false);
    }, 700);
  }

  function responderComoHumano() {
    const texto = respostaInbox.trim();
    if (!texto || !handoffAtivo) return;

    adicionar(handoffAtivo.perfil, texto);
    setRespostaInbox("");
    setHandoffAtivo(null);
  }

  function reiniciar() {
    setMensagens([
      {
        id: proximoId++,
        autor: "sistema",
        texto: "Converse com o agente da SOMA como se fosse um cliente real, pelo WhatsApp.",
      },
    ]);
    setHandoffAtivo(null);
    setInput("");
    setRespostaInbox("");
    setCdProcesso("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent">
          <Sparkles className="h-3 w-3" />
          Simulação — teste você mesmo
        </span>
        <button
          type="button"
          onClick={reiniciar}
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Reiniciar conversa
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="cd_processo_demo" className="text-xs text-muted-foreground">
          Vincular a um processo (opcional):
        </label>
        <input
          id="cd_processo_demo"
          value={cdProcesso}
          onChange={(e) => setCdProcesso(e.target.value)}
          placeholder="SOMA-2026-0001"
          className="h-7 w-40 rounded-md border border-border bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col rounded-radius border border-border bg-muted/50">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 text-xs font-semibold text-muted-foreground">
            <MessageCircle className="h-4 w-4 text-[#1F9E56]" />
            WhatsApp Business — SOMA
            {cdProcesso && (
              <span className="ml-auto rounded-full bg-brand/5 px-2 py-0.5 text-[10px] font-medium text-brand">
                {cdProcesso}
              </span>
            )}
          </div>

          <div className="flex max-h-80 min-h-80 flex-col gap-2 overflow-y-auto p-4">
            {mensagens.map((mensagem) => {
              if (mensagem.autor === "sistema") {
                return (
                  <div
                    key={mensagem.id}
                    className="mx-auto max-w-[90%] rounded-lg border border-dashed border-accent/50 bg-accent/10 px-3 py-2 text-center text-xs font-semibold text-accent"
                  >
                    {mensagem.texto}
                  </div>
                );
              }

              const doCliente = mensagem.autor === "cliente";
              return (
                <div
                  key={mensagem.id}
                  className={cn(
                    "max-w-[85%] rounded-2xl border px-3 py-2 text-sm",
                    doCliente
                      ? "self-start rounded-bl-sm border-border bg-card"
                      : mensagem.autor === "ia"
                        ? "self-end rounded-br-sm border-[#1F9E56]/30 bg-[#1F9E56]/10"
                        : "self-end rounded-br-sm border-brand/20 bg-brand/5"
                  )}
                >
                  <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted-foreground/70">
                    {AUTOR_LABEL[mensagem.autor]}
                  </span>
                  {mensagem.texto}
                </div>
              );
            })}
            {digitando && (
              <div className="self-end text-xs italic text-muted-foreground">
                Agente SOMA (IA) está digitando...
              </div>
            )}
            <div ref={fimRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              placeholder="Digite como se fosse o cliente..."
              className="h-9 flex-1 rounded-full border border-border bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
            <button
              type="button"
              onClick={enviar}
              disabled={!input.trim() || digitando}
              className="h-9 shrink-0 rounded-full bg-brand px-4 text-sm font-medium text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Enviar
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Inbox interna
          </p>
          {handoffAtivo ? (
            <div className="flex flex-col gap-2 rounded-radius border border-brand/20 bg-brand/5 p-3">
              <span className="w-fit rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-foreground">
                {PERFIL_LABEL[handoffAtivo.perfil]}
              </span>
              <p className="text-xs text-muted-foreground">{handoffAtivo.motivo}</p>
              <textarea
                value={respostaInbox}
                onChange={(e) => setRespostaInbox(e.target.value)}
                placeholder={`Responder como ${PERFIL_LABEL[handoffAtivo.perfil]}...`}
                className="min-h-16 w-full rounded-md border border-border bg-card px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              <button
                type="button"
                onClick={responderComoHumano}
                disabled={!respostaInbox.trim()}
                className="self-start rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-brand-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enviar resposta
              </button>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-radius border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
              Nenhuma conversa esperando atendimento humano agora. Mande uma mensagem sobre contrato,
              pagamento ou prazo de cartório pra ver o handoff acontecer.
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] italic text-muted-foreground/70">
        Simulação por palavra-chave, só pra testar o fluxo hoje — a versão final classifica com a API
        da Claude, em tempo real, dentro do agente em n8n.
      </p>
    </div>
  );
}
