"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarTelefone } from "@/lib/utils";
import { atualizarMeusDados } from "./actions";

export function MeuPerfilForm({
  nmUsuario,
  dsTelefone,
}: {
  nmUsuario: string;
  dsTelefone: string;
}) {
  const [state, action, pending] = useActionState(atualizarMeusDados, null);
  const [telefone, setTelefone] = useState(dsTelefone);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nm_usuario">Nome</Label>
          <Input id="nm_usuario" name="nm_usuario" defaultValue={nmUsuario} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_telefone">Telefone</Label>
          <Input
            id="ds_telefone"
            name="ds_telefone"
            value={telefone}
            onChange={(e) => setTelefone(formatarTelefone(e.target.value))}
            placeholder="(71) 99999-9999"
          />
        </div>
      </div>

      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Salvar dados"}
      </Button>
      {state?.erro && <p className="text-sm text-status-reprovado">{state.erro}</p>}
      {state?.sucesso && <p className="text-sm text-status-aceito">Dados atualizados.</p>}
    </form>
  );
}
