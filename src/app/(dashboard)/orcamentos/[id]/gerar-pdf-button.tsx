"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { gerarPdfOrcamento } from "./actions";

export function GerarPdfButton({ cdOrcamento }: { cdOrcamento: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await gerarPdfOrcamento(cdOrcamento);

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" onClick={gerar} disabled={pending}>
        {pending ? "Gerando PDF..." : "Gerar / atualizar PDF"}
      </Button>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
