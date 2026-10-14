"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { StatusDocumento } from "@/types/database";
import { validarDocumento } from "./documentos-actions";

// Documento já entra validado (migration 056) — aqui só aparece o que
// muda o status atual: rejeitar um validado, ou voltar a validar um
// rejeitado. Os antigos que ficaram "pendente" mostram os dois.
export function DocumentoValidarBotoes({
  cdDocumento,
  status,
}: {
  cdDocumento: string;
  status: StatusDocumento;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function definirStatus(novo: "validado" | "rejeitado") {
    const observacao =
      novo === "rejeitado" ? window.prompt("Motivo da rejeição (opcional):") : null;
    if (novo === "rejeitado" && observacao === null) return; // cancelou

    startTransition(async () => {
      await validarDocumento(cdDocumento, novo, observacao || null);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      {status !== "validado" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => definirStatus("validado")}
        >
          Validar
        </Button>
      )}
      {status !== "rejeitado" && (
        <Button
          type="button"
          variant={status === "pendente" ? "destructive" : "ghost"}
          size="sm"
          disabled={pending}
          onClick={() => definirStatus("rejeitado")}
          className={status === "validado" ? "text-xs text-muted-foreground" : undefined}
        >
          Rejeitar
        </Button>
      )}
    </div>
  );
}
