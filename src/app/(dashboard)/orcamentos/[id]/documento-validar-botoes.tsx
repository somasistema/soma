"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { validarDocumento } from "./documentos-actions";

export function DocumentoValidarBotoes({ cdDocumento }: { cdDocumento: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function definirStatus(status: "validado" | "rejeitado") {
    startTransition(async () => {
      const observacao =
        status === "rejeitado" ? window.prompt("Motivo da rejeição (opcional):") ?? "" : null;

      await validarDocumento(cdDocumento, status, observacao || null);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => definirStatus("validado")}
      >
        Validar
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => definirStatus("rejeitado")}
      >
        Rejeitar
      </Button>
    </div>
  );
}
