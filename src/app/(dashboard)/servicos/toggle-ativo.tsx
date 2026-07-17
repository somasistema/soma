"use client";

import { Power, PowerOff } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { alternarAtivoServico } from "./actions";

export function ToggleAtivo({ cd_servico, sn_ativo }: { cd_servico: string; sn_ativo: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => alternarAtivoServico(cd_servico, !sn_ativo))}
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      {sn_ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
      {sn_ativo ? "Desativar" : "Ativar"}
    </Button>
  );
}
