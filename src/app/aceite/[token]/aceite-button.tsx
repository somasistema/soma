"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { aceitarOrcamento } from "./actions";

export function AceiteButton({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function aceitar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await aceitarOrcamento(token);

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" onClick={aceitar} disabled={pending} className="self-start">
        {pending ? "Registrando aceite..." : "Aceitar orçamento"}
      </Button>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
