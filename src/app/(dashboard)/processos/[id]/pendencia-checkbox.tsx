"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import type { StatusPendencia } from "@/types/database";
import { atualizarStatusPendencia } from "./actions";

export function PendenciaCheckbox({
  cdPendencia,
  status,
}: {
  cdPendencia: string;
  status: StatusPendencia;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function alternar() {
    const novoStatus: StatusPendencia = status === "concluida" ? "aberta" : "concluida";
    startTransition(async () => {
      await atualizarStatusPendencia(cdPendencia, novoStatus);
      router.refresh();
    });
  }

  return (
    <Checkbox checked={status === "concluida"} disabled={pending} onChange={alternar} />
  );
}
