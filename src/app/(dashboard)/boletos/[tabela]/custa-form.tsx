"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TabelaCusta } from "@/types/database";
import { criarCusta } from "../actions";

export function CustaForm({ tabela }: { tabela: TabelaCusta }) {
  const [state, action, pending] = useActionState(criarCusta, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state === null) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Plus className="h-5 w-5 text-accent" />
        <CardTitle>Novo boleto — {tabela}</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <input type="hidden" name="tp_tabela" value={tabela} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cd_ato">Código do ato</Label>
              <Input id="cd_ato" name="cd_ato" placeholder="Ex: 32069" />
            </div>
            <div className="flex flex-1 flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="nm_secao">Seção</Label>
              <Input id="nm_secao" name="nm_secao" placeholder="Ex: I - Causas em geral" required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds_ato">Descrição do ato</Label>
            <Input id="ds_ato" name="ds_ato" required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vl_faixa_min">Faixa — de (R$)</Label>
              <Input id="vl_faixa_min" name="vl_faixa_min" type="number" step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vl_faixa_max">Faixa — até (R$)</Label>
              <Input id="vl_faixa_max" name="vl_faixa_max" type="number" step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="vl_pagar">Valor a pagar (R$)</Label>
              <Input id="vl_pagar" name="vl_pagar" type="number" step="0.01" min="0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ds_valor_especial">Valor especial</Label>
              <Input
                id="ds_valor_especial"
                name="ds_valor_especial"
                placeholder="Ex: Gratuita, Isento..."
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Preencha faixa (de/até) quando o valor variar por faixa, ou só &quot;Valor a
            pagar&quot; quando for fixo. &quot;Valor especial&quot; é pra atos sem valor
            monetário (Gratuita, Isento etc).
          </p>

          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Salvando..." : "Adicionar"}
          </Button>
          {state?.erro && <p className="text-sm text-status-reprovado">{state.erro}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
