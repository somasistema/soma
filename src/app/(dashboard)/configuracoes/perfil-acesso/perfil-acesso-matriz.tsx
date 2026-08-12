"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ROLE_LABEL,
  SECAO_ACESSO_LABEL,
  SECOES_ACESSO,
  SECOES_COM_CRUD,
  type AcaoPermissao,
  type PerfilAcesso,
  type RoleUsuario,
  type SecaoAcesso,
} from "@/types/database";
import { alternarAcesso } from "./actions";

// Master fica de fora — sempre tem acesso a tudo, hardcoded no app
// (lib/auth.ts), pra ninguém conseguir se trancar fora da própria
// tela que configuraria isso de volta.
const ROLES_CONFIGURAVEIS: RoleUsuario[] = [
  "juridico",
  "imobiliaria",
  "despachante",
  "corretor",
  "vendedor",
  "comprador",
  "outro_cliente",
];

const ACOES_CRUD: { acao: AcaoPermissao; rotulo: string }[] = [
  { acao: "ver", rotulo: "Ver" },
  { acao: "criar", rotulo: "Criar" },
  { acao: "editar", rotulo: "Editar" },
  { acao: "excluir", rotulo: "Excluir" },
];

const SECOES_SIMPLES = SECOES_ACESSO.filter((s) => !SECOES_COM_CRUD.includes(s));

function chave(role: RoleUsuario, secao: SecaoAcesso, acao: AcaoPermissao) {
  return `${role}::${secao}::${acao}`;
}

export function PerfilAcessoMatriz({ acessos }: { acessos: PerfilAcesso[] }) {
  const mapaInicial = useMemo(() => {
    const mapa = new Map<string, boolean>();
    for (const acesso of acessos) {
      mapa.set(chave(acesso.tp_role, acesso.cd_secao, "ver"), acesso.sn_ver);
      mapa.set(chave(acesso.tp_role, acesso.cd_secao, "criar"), acesso.sn_criar);
      mapa.set(chave(acesso.tp_role, acesso.cd_secao, "editar"), acesso.sn_editar);
      mapa.set(chave(acesso.tp_role, acesso.cd_secao, "excluir"), acesso.sn_excluir);
    }
    return mapa;
  }, [acessos]);

  const [estado, setEstado] = useState(mapaInicial);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(role: RoleUsuario, secao: SecaoAcesso, acao: AcaoPermissao) {
    const k = chave(role, secao, acao);
    const novoValor = !estado.get(k);

    setEstado((atual) => new Map(atual).set(k, novoValor));
    setErro(null);

    alternarAcesso(role, secao, acao, novoValor).then((resultado) => {
      if (resultado.erro) {
        setErro(resultado.erro);
        setEstado((atual) => new Map(atual).set(k, !novoValor));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acesso simples</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="bg-muted text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Perfil</th>
                {SECOES_SIMPLES.map((secao) => (
                  <th key={secao} className="px-3 py-2 text-center font-medium">
                    {SECAO_ACESSO_LABEL[secao]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES_CONFIGURAVEIS.map((role) => (
                <tr key={role} className="border-t border-border">
                  <td className="px-3 py-2 font-medium text-foreground">{ROLE_LABEL[role]}</td>
                  {SECOES_SIMPLES.map((secao) => (
                    <td key={secao} className="px-3 py-2 text-center">
                      <Checkbox
                        checked={estado.get(chave(role, secao, "ver")) ?? false}
                        onChange={() => alternar(role, secao, "ver")}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {SECOES_COM_CRUD.map((secao) => (
        <Card key={secao}>
          <CardHeader>
            <CardTitle className="text-base">{SECAO_ACESSO_LABEL[secao]}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Perfil</th>
                  {ACOES_CRUD.map(({ acao, rotulo }) => (
                    <th key={acao} className="px-3 py-2 text-center font-medium">
                      {rotulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROLES_CONFIGURAVEIS.map((role) => (
                  <tr key={role} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{ROLE_LABEL[role]}</td>
                    {ACOES_CRUD.map(({ acao }) => (
                      <td key={acao} className="px-3 py-2 text-center">
                        <Checkbox
                          checked={estado.get(chave(role, secao, acao)) ?? false}
                          onChange={() => alternar(role, secao, acao)}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
