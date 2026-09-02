"use client";

import { RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PAPEL_APROVACAO_LABEL,
  STATUS_CONTRATO_LABEL,
  STATUS_SIGNATARIO_LABEL,
  type Contrato,
  type ContratoSignatario,
} from "@/types/database";
import { reenviarAssinatura } from "./minuta-actions";

const STATUS_SIGNATARIO_CLASS: Record<ContratoSignatario["tp_status"], string> = {
  pendente: "bg-status-pendente/15 text-status-pendente",
  assinado: "bg-status-aceito/15 text-status-aceito",
  recusado: "bg-status-reprovado/15 text-status-reprovado",
};

export function ContratoAssinatura({
  contrato,
  signatarios,
  assinaturaConfigurada,
  podeReenviar,
  urlContratoAssinado,
}: {
  contrato: Contrato;
  signatarios: ContratoSignatario[];
  assinaturaConfigurada: boolean;
  podeReenviar: boolean;
  urlContratoAssinado: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const enviado = Boolean(contrato.ds_documento_externo_id);

  function reenviar() {
    setErro(null);
    startTransition(async () => {
      const r = await reenviarAssinatura(contrato.cd_contrato);
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          Assinatura digital —{" "}
          <span className="font-normal text-muted-foreground">
            {STATUS_CONTRATO_LABEL[contrato.tp_status]}
          </span>
        </span>
        {contrato.ds_url_documento && (
          <a
            href={contrato.ds_url_documento}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand underline"
          >
            acompanhar no provedor
          </a>
        )}
      </div>

      {!assinaturaConfigurada && !enviado && (
        <p className="text-xs text-muted-foreground">
          Assinatura digital ainda não configurada — defina o token da Autentique para o envio
          automático passar a acontecer.
        </p>
      )}

      {contrato.ds_erro_envio && contrato.tp_status !== "assinado" && (
        <p className="text-xs text-status-reprovado">Falha no envio: {contrato.ds_erro_envio}</p>
      )}

      {signatarios.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {signatarios.map((s) => (
            <div
              key={s.cd_signatario}
              className="flex items-center justify-between gap-2 rounded-radius border border-border px-3 py-2"
            >
              <span className="min-w-0 text-sm text-foreground">
                {PAPEL_APROVACAO_LABEL[s.tp_papel]}
                <span className="ml-2 text-xs text-muted-foreground">{s.nm_signatario}</span>
              </span>
              <div className="flex shrink-0 items-center gap-2">
                {s.ds_url_assinatura && s.tp_status === "pendente" && (
                  <a
                    href={s.ds_url_assinatura}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand underline"
                  >
                    link
                  </a>
                )}
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    STATUS_SIGNATARIO_CLASS[s.tp_status]
                  )}
                >
                  {STATUS_SIGNATARIO_LABEL[s.tp_status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {urlContratoAssinado && (
        <a
          href={urlContratoAssinado}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-brand underline"
        >
          Baixar contrato assinado (PDF)
        </a>
      )}

      {podeReenviar &&
        assinaturaConfigurada &&
        contrato.tp_status !== "assinado" &&
        contrato.tp_status !== "enviado" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="w-fit gap-1.5"
            disabled={pending}
            onClick={reenviar}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
            {enviado ? "Reenviar para assinatura" : "Enviar para assinatura"}
          </Button>
        )}

      {erro && <p className="text-xs text-status-reprovado">{erro}</p>}
    </div>
  );
}
