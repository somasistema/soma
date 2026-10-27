"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enviarMinutaPorEmail } from "./minuta-actions";

export function MinutaEnviarEmail({
  cdMinuta,
  jaEnviada,
  faltamEnviar,
}: {
  cdMinuta: string;
  jaEnviada: boolean;
  // Algum e-mail ainda não saiu (falhou antes): o botão manda só esses.
  faltamEnviar: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  function enviar() {
    setAviso(null);
    startTransition(async () => {
      const r = await enviarMinutaPorEmail(cdMinuta);
      if (!r.sucesso) {
        setAviso({ ok: false, texto: r.erro });
        return;
      }
      const partes = [`${r.enviados} e-mail(s) enviado(s)`];
      if (r.jaRecebiam > 0) partes.push(`${r.jaRecebiam} já tinha(m) recebido`);
      if (r.jaResponderam > 0) partes.push(`${r.jaResponderam} já tinha(m) respondido`);
      if (r.falhas.length > 0) partes.push(`falhou: ${r.falhas.join(" | ")}`);
      setAviso({ ok: r.falhas.length === 0, texto: partes.join(" · ") });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-radius border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-foreground">
          Cada pessoa recebe um link por e-mail, lê a minuta em PDF e aceita ou recusa (a recusa
          pede o motivo).
        </p>
        <Button type="button" size="sm" disabled={pending} onClick={enviar}>
          <Mail className="h-4 w-4" />
          {pending
            ? "Enviando..."
            : faltamEnviar
              ? "Enviar os e-mails que faltam"
              : jaEnviada
                ? "Reenviar para quem não respondeu"
                : "Enviar para aprovação por e-mail"}
        </Button>
      </div>
      {aviso && (
        <p className={aviso.ok ? "text-sm text-status-aceito" : "text-sm text-status-reprovado"}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}
