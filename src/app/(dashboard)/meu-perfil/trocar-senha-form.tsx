"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trocarMinhaSenha } from "./actions";

export function TrocarSenhaForm() {
  const [state, action, pending] = useActionState(trocarMinhaSenha, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.sucesso) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="senha">Nova senha</Label>
          <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirmacao">Confirme a senha</Label>
          <Input
            id="confirmacao"
            name="confirmacao"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Trocar senha"}
      </Button>
      {state?.erro && <p className="text-sm text-status-reprovado">{state.erro}</p>}
      {state?.sucesso && <p className="text-sm text-status-aceito">Senha atualizada.</p>}
    </form>
  );
}
