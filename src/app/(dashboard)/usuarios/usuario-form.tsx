"use client";

import { UserPlus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ROLE_LABEL, type Imobiliaria, type RoleUsuario } from "@/types/database";
import { criarUsuario } from "./actions";

const ROLES_CRIAVEIS: RoleUsuario[] = [
  "master",
  "juridico",
  "imobiliaria",
  "despachante",
  "corretor",
  "vendedor",
  "outro_cliente",
];

export function UsuarioForm({ imobiliarias }: { imobiliarias: Imobiliaria[] }) {
  const [state, action, pending] = useActionState(criarUsuario, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.sucesso) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <UserPlus className="h-5 w-5 text-accent" />
        <CardTitle>Novo usuário</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="flex flex-wrap items-end gap-4">
          <div className="flex flex-1 min-w-48 flex-col gap-1.5">
            <Label htmlFor="nm_usuario">Nome</Label>
            <Input id="nm_usuario" name="nm_usuario" required />
          </div>
          <div className="flex flex-1 min-w-48 flex-col gap-1.5">
            <Label htmlFor="ds_email">E-mail</Label>
            <Input id="ds_email" name="ds_email" type="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp_role">Perfil</Label>
            <Select id="tp_role" name="tp_role" defaultValue="despachante">
              {ROLES_CRIAVEIS.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABEL[role]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cd_imobiliaria">Imobiliária (opcional)</Label>
            <Select id="cd_imobiliaria" name="cd_imobiliaria" defaultValue="">
              <option value="">Nenhuma</option>
              {imobiliarias.map((imobiliaria) => (
                <option key={imobiliaria.cd_imobiliaria} value={imobiliaria.cd_imobiliaria}>
                  {imobiliaria.nm_imobiliaria}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Enviando convite..." : "Criar e convidar"}
          </Button>
          {state && !state.sucesso && (
            <p className="w-full text-sm text-status-reprovado">{state.erro}</p>
          )}
          {state?.sucesso && (
            <p className="w-full text-sm text-status-aceito">
              Usuário criado — um e-mail de convite foi enviado pra definir a senha.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
