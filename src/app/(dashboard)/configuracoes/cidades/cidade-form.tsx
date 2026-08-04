"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { criarCidade } from "./actions";

export function CidadeForm() {
  const [state, action, pending] = useActionState(criarCidade, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <label htmlFor="nm_cidade" className="text-sm font-medium text-foreground">
          Nova cidade
        </label>
        <Input id="nm_cidade" name="nm_cidade" placeholder="Ex: Itabuna" required />
      </div>
      <Button type="submit" disabled={pending} className="gap-1.5">
        <Plus className="h-4 w-4" />
        {pending ? "Salvando..." : "Adicionar"}
      </Button>
      {state?.erro && <p className="text-sm text-status-reprovado">{state.erro}</p>}
    </form>
  );
}
