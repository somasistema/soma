"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { excluirProcesso } from "./actions";

// Pede pra digitar o número do processo — apagar leva tudo junto
// (documentos, minuta, contrato, orçamentos) e não tem volta.
export function ExcluirProcessoButton({
  cdProcesso,
  numeroProcesso,
}: {
  cdProcesso: string;
  numeroProcesso: string;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function excluir() {
    const digitado = window.prompt(
      `Isso apaga o processo ${numeroProcesso} e tudo dele (partes, documentos, minuta, contrato, orçamentos, conversa). Não tem como desfazer.\n\nPra confirmar, digite o número do processo:`
    );
    if (digitado === null) return;
    if (digitado.trim().toUpperCase() !== numeroProcesso.toUpperCase()) {
      setErro("Número não confere — nada foi apagado.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const r = await excluirProcesso(cdProcesso);
      // Sucesso redireciona; aqui só chega erro.
      if (r && !r.sucesso) setErro(r.erro);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground hover:text-status-reprovado"
        disabled={pending}
        onClick={excluir}
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? "Excluindo..." : "Excluir processo"}
      </Button>
      {erro && <p className="text-xs text-status-reprovado">{erro}</p>}
    </div>
  );
}
