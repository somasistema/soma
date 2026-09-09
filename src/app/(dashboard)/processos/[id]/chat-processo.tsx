"use client";

import { Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn, formatarDataHora } from "@/lib/utils";
import { enviarMensagemProcesso } from "./chat-actions";

type Mensagem = {
  cd_mensagem: string;
  cd_autor: string;
  nm_autor: string;
  ds_texto: string;
  ts_criacao: string;
};

export function ChatProcesso({
  cdProcesso,
  cdUsuarioAtual,
}: {
  cdProcesso: string;
  cdUsuarioAtual: string;
}) {
  const [supabase] = useState(() => createClient());
  const fimRef = useRef<HTMLDivElement>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, startEnviar] = useTransition();

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .schema("soma")
      .from("mensagens_processo")
      .select("cd_mensagem, cd_autor, nm_autor, ds_texto, ts_criacao")
      .eq("cd_processo", cdProcesso)
      .order("ts_criacao", { ascending: true })
      .limit(300)
      .returns<Mensagem[]>();
    setMensagens(data ?? []);
  }, [supabase, cdProcesso]);

  useEffect(() => {
    // carregar() é async: o setState só roda depois do await, não em cascata.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar();
    const canal = supabase
      .channel(`chat-${cdProcesso}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "soma",
          table: "mensagens_processo",
          filter: `cd_processo=eq.${cdProcesso}`,
        },
        () => carregar()
      )
      .subscribe();
    // Rede de segurança caso o Realtime não esteja habilitado no schema.
    const intervalo = setInterval(carregar, 20000);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(intervalo);
    };
  }, [supabase, cdProcesso, carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens.length]);

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    setErro(null);
    startEnviar(async () => {
      const r = await enviarMensagemProcesso(cdProcesso, t);
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      setTexto("");
      carregar();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-[26rem] min-h-[8rem] flex-col gap-2 overflow-y-auto rounded-radius border border-border bg-card p-3">
        {mensagens.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
        ) : (
          mensagens.map((m) => {
            const meu = m.cd_autor === cdUsuarioAtual;
            return (
              <div
                key={m.cd_mensagem}
                className={cn("flex flex-col", meu ? "items-end" : "items-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-radius px-3 py-2 text-sm",
                    meu ? "bg-brand/15" : "bg-muted"
                  )}
                >
                  {!meu && (
                    <p className="mb-0.5 text-xs font-medium text-muted-foreground">{m.nm_autor}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-foreground">{m.ds_texto}</p>
                </div>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatarDataHora(m.ts_criacao)}
                </span>
              </div>
            );
          })
        )}
        <div ref={fimRef} />
      </div>

      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          rows={2}
          placeholder="Escreva uma mensagem para o grupo do processo..."
          className="flex-1 resize-none rounded-radius border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <Button
          type="button"
          size="icon"
          disabled={enviando || !texto.trim()}
          onClick={enviar}
          aria-label="Enviar mensagem"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
