"use client";

import { Power, PowerOff } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { alternarAtivoUsuario } from "./actions";

export function ToggleAtivoUsuario({ cdUsuario, ativo }: { cdUsuario: string; ativo: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await alternarAtivoUsuario(cdUsuario, !ativo);
        })
      }
      className="gap-1.5 text-muted-foreground hover:text-foreground"
    >
      {ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
      {ativo ? "Desativar" : "Ativar"}
    </Button>
  );
}
