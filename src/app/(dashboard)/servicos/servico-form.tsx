"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { criarServico } from "./actions";

export function ServicoForm() {
  const [state, action, pending] = useActionState(criarServico, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Plus className="h-5 w-5 text-accent" />
        <CardTitle>Novo serviço</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-1 min-w-48 flex-col gap-1.5">
            <Label htmlFor="nm_servico">Nome</Label>
            <Input id="nm_servico" name="nm_servico" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp_servico">Tipo</Label>
            <Select id="tp_servico" name="tp_servico" defaultValue="honorario">
              <option value="honorario">Honorário</option>
              <option value="custa">Custa</option>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vl_servico">Valor</Label>
            <Input id="vl_servico" name="vl_servico" type="number" step="0.01" min="0" required />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Adicionar"}
          </Button>
          {state?.erro && <p className="w-full text-sm text-status-reprovado">{state.erro}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
