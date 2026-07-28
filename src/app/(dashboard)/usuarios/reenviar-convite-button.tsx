"use client";

import { Send } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { reenviarConvite } from "./actions";

export function ReenviarConviteButton({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);

  function reenviar() {
    setMensagem(null);
    startTransition(async () => {
      const resultado = await reenviarConvite(email);
      setMensagem(resultado.sucesso ? "Convite reenviado." : resultado.erro);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={reenviar}
        className="gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Send className="h-4 w-4" />
        Reenviar convite
      </Button>
      {mensagem && <p className="text-xs text-muted-foreground">{mensagem}</p>}
    </div>
  );
}
