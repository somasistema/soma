"use client";

import { AlertTriangle, Check, RefreshCw, ScanText, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CAMPO_OCR_LABEL,
  STATUS_OCR_LABEL,
  TIPO_DOCUMENTO_OCR_LABEL,
  type DocumentoOcr,
  type DocumentoOcrCampo,
} from "@/types/database";
import { confirmarCampoOcr, reprocessarOcr } from "./documentos-actions";

const STATUS_CLASS: Record<DocumentoOcr["tp_status"], string> = {
  na_fila: "bg-status-pendente/15 text-status-pendente",
  processando: "bg-status-pendente/15 text-status-pendente",
  concluido: "bg-status-aceito/15 text-status-aceito",
  falha: "bg-status-reprovado/15 text-status-reprovado",
};

function rotuloCampo(nm: string) {
  return CAMPO_OCR_LABEL[nm] ?? nm;
}

function CampoLinha({ campo }: { campo: DocumentoOcrCampo }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(campo.ds_valor);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const iaDiscorda = campo.sn_confere_ia === false && !campo.sn_confirmado;

  function confirmar(valorFinal: string) {
    setErro(null);
    startTransition(async () => {
      const r = await confirmarCampoOcr(campo.cd_campo, valorFinal);
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border py-2 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{rotuloCampo(campo.nm_campo)}</span>
        <div className="flex items-center gap-1.5">
          {campo.sn_confirmado ? (
            <span className="inline-flex items-center gap-1 text-xs text-status-aceito">
              <Check className="h-3 w-3" /> conferido
            </span>
          ) : iaDiscorda ? (
            <span className="inline-flex items-center gap-1 text-xs text-status-reprovado">
              <AlertTriangle className="h-3 w-3" /> IA discorda
            </span>
          ) : campo.sn_confere_ia === true ? (
            <span className="inline-flex items-center gap-1 text-xs text-status-aceito">
              <Sparkles className="h-3 w-3" /> IA confere
            </span>
          ) : (
            typeof campo.nr_confianca === "number" && (
              <span className="text-xs text-muted-foreground">{Math.round(campo.nr_confianca)}%</span>
            )
          )}
          {!editando && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              onClick={() => setEditando(true)}
            >
              {campo.sn_confirmado ? "editar" : "conferir"}
            </Button>
          )}
        </div>
      </div>

      {editando ? (
        <div className="flex items-center gap-2">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-8 text-sm"
          />
          <Button type="button" size="sm" className="h-8" disabled={pending} onClick={() => confirmar(valor)}>
            {pending ? "..." : "Salvar"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8"
            disabled={pending}
            onClick={() => {
              setValor(campo.ds_valor);
              setEditando(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      ) : (
        <span className="font-mono text-sm text-foreground">{campo.ds_valor}</span>
      )}

      {iaDiscorda && campo.ds_valor_sugerido_ia && !editando && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            IA sugere: <span className="font-mono text-foreground">{campo.ds_valor_sugerido_ia}</span>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            disabled={pending}
            onClick={() => confirmar(campo.ds_valor_sugerido_ia as string)}
          >
            usar sugestão
          </Button>
        </div>
      )}
      {erro && <span className="text-xs text-status-reprovado">{erro}</span>}
    </div>
  );
}

export function DocumentoOcrPainel({
  cdDocumento,
  ocr,
  campos,
}: {
  cdDocumento: string;
  ocr: DocumentoOcr | null;
  campos: DocumentoOcrCampo[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const status = ocr?.tp_status ?? "na_fila";
  const emAndamento = status === "na_fila" || status === "processando";

  function reprocessar() {
    setErro(null);
    startTransition(async () => {
      const r = await reprocessarOcr(cdDocumento);
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-radius border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
          <ScanText className="h-3.5 w-3.5 text-accent" />
          Leitura automática (OCR)
        </span>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[status]}`}
          >
            {STATUS_OCR_LABEL[status]}
          </span>
          {!emAndamento && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 gap-1 px-2 text-xs"
              disabled={pending}
              onClick={reprocessar}
            >
              <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
              reprocessar
            </Button>
          )}
        </div>
      </div>

      {erro && <p className="mt-2 text-xs text-status-reprovado">{erro}</p>}

      {status === "falha" && ocr?.ds_erro && (
        <p className="mt-2 text-xs text-status-reprovado">{ocr.ds_erro}</p>
      )}

      {emAndamento && (
        <p className="mt-2 text-xs text-muted-foreground">
          O documento está sendo lido. Atualize a página em alguns instantes.
        </p>
      )}

      {status === "concluido" && ocr && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {ocr.tp_documento_detectado && (
              <span>
                Tipo detectado:{" "}
                <strong className="text-foreground">
                  {TIPO_DOCUMENTO_OCR_LABEL[ocr.tp_documento_detectado]}
                </strong>
              </span>
            )}
            {typeof ocr.nr_confianca === "number" && (
              <span>
                Confiança da leitura:{" "}
                <strong className="text-foreground">{Math.round(ocr.nr_confianca)}%</strong>
              </span>
            )}
            {ocr.nr_paginas ? <span>{ocr.nr_paginas} pág.</span> : null}
            {ocr.ts_validacao_ia && (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-accent" />
                Conferido por IA
              </span>
            )}
          </div>

          {ocr.sn_tipo_confere_ia === false && ocr.tp_documento_sugerido_ia && (
            <p className="flex items-center gap-1.5 text-xs text-status-reprovado">
              <AlertTriangle className="h-3 w-3" />
              A IA acha que o tipo real é <strong>{ocr.tp_documento_sugerido_ia}</strong>, não o
              detectado acima — confira o documento.
            </p>
          )}

          {campos.length > 0 ? (
            <div className="rounded-radius border border-border bg-card px-3">
              {campos.map((campo) => (
                <CampoLinha key={campo.cd_campo} campo={campo} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nenhum campo estruturado reconhecido — confira o texto abaixo.
            </p>
          )}

          {ocr.ds_texto_extraido && (
            <details className="rounded-radius border border-border bg-card p-2">
              <summary className="cursor-pointer text-xs text-foreground">Ver texto lido</summary>
              <pre className="mt-2 max-h-[300px] overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
                {ocr.ds_texto_extraido}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
