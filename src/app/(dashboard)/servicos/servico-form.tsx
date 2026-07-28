"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CIDADES_SERVICO, type LocalServico } from "@/types/database";
import { criarServico } from "./actions";

export function ServicoForm({ local }: { local: LocalServico }) {
  const [state, action, pending] = useActionState(criarServico, null);
  const formRef = useRef<HTMLFormElement>(null);
  const precosRef = useRef<HTMLDivElement>(null);

  // Checkbox e campos de preço são não-controlados — formRef.reset() já
  // devolve o estado inicial deles nativamente, sem precisar de setState
  // (e sem precisar sincronizar nada) dentro do efeito de reset.
  useEffect(() => {
    if (state === null) {
      formRef.current?.reset();
      if (precosRef.current) precosRef.current.hidden = false;
    }
  }, [state]);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Plus className="h-5 w-5 text-accent" />
        <CardTitle>Novo serviço — {local}</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <input type="hidden" name="tp_local" value={local} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cd_codigo">Código</Label>
              <Input id="cd_codigo" name="cd_codigo" placeholder="Ex: SEF01" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nm_categoria">Categoria (tipo)</Label>
              <Input id="nm_categoria" name="nm_categoria" placeholder="Ex: Certidão" required />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="nm_servico">Descrição</Label>
              <Input id="nm_servico" name="nm_servico" required />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox
              name="sn_valor_variavel"
              onChange={(e) => {
                if (precosRef.current) precosRef.current.hidden = e.target.checked;
              }}
            />
            Valor variável (sem preço fixo — definido item a item no orçamento)
          </label>

          <div ref={precosRef} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vl_salvador">{CIDADES_SERVICO[0]}</Label>
              <Input id="vl_salvador" name="vl_salvador" type="number" step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vl_lauro">{CIDADES_SERVICO[1]}</Label>
              <Input id="vl_lauro" name="vl_lauro" type="number" step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vl_camacari">{CIDADES_SERVICO[2]}</Label>
              <Input id="vl_camacari" name="vl_camacari" type="number" step="0.01" min="0" />
            </div>
          </div>

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Salvando..." : "Adicionar"}
          </Button>
          {state?.erro && <p className="text-sm text-status-reprovado">{state.erro}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
