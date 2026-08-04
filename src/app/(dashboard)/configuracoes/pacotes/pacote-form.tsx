"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ServicoCombobox } from "@/components/servico-combobox";
import { BoletoCombobox } from "@/components/boleto-combobox";
import type { ServicoComPrecos, TabelaCustaItem } from "@/types/database";
import { criarPacoteItem } from "./actions";

export function PacoteForm({
  servicos,
  custas,
  cidades,
}: {
  servicos: ServicoComPrecos[];
  custas: TabelaCustaItem[];
  cidades: string[];
}) {
  const [state, action, pending] = useActionState(criarPacoteItem, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [cdServico, setCdServico] = useState("");
  const [cdCusta, setCdCusta] = useState("");

  // Ao voltar pro estado "sucesso" (null) depois de um submit, limpa os
  // combobox controlados — feito durante a renderização (não em efeito)
  // pra não disparar setState encadeado.
  const [estadoAnterior, setEstadoAnterior] = useState(state);
  if (state !== estadoAnterior) {
    setEstadoAnterior(state);
    if (state === null) {
      setCdServico("");
      setCdCusta("");
    }
  }

  useEffect(() => {
    if (state === null) formRef.current?.reset();
  }, [state]);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Plus className="h-5 w-5 text-accent" />
        <CardTitle>Vincular boleto a um serviço</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <input type="hidden" name="cd_servico" value={cdServico} />
          <input type="hidden" name="cd_custa" value={cdCusta} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Serviço</Label>
              <ServicoCombobox
                servicos={servicos}
                nmCidade={cidades[0] ?? ""}
                value={cdServico}
                onChange={setCdServico}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Boleto</Label>
              <BoletoCombobox custas={custas} value={cdCusta} onChange={setCdCusta} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox name="sn_opcional" />
            Opcional — sugerido, mas o operador decide se mantém em cada orçamento
          </label>

          <Button type="submit" disabled={pending || !cdServico || !cdCusta} className="self-start">
            {pending ? "Salvando..." : "Vincular"}
          </Button>
          {state?.erro && <p className="text-sm text-status-reprovado">{state.erro}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
