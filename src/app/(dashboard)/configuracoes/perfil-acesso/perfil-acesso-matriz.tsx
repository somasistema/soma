"use client";

import { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ROLE_LABEL,
  SECAO_ACESSO_LABEL,
  SECOES_ACESSO,
  type PerfilAcesso,
  type RoleUsuario,
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

export function PerfilAcessoMatriz({ acessos }: { acessos: PerfilAcesso[] }) {
  const mapaInicial = useMemo(() => {
    const mapa = new Map<string, boolean>();
    for (const acesso of acessos) {
      mapa.set(`${acesso.tp_role}::${acesso.cd_secao}`, acesso.sn_ativo);
    }
    return mapa;
  }, [acessos]);

  const [estado, setEstado] = useState(mapaInicial);
  const [erro, setErro] = useState<string | null>(null);

  function alternar(tpRole: RoleUsuario, cdSecao: (typeof SECOES_ACESSO)[number]) {
    const chave = `${tpRole}::${cdSecao}`;
    const novoValor = !estado.get(chave);

    setEstado((atual) => new Map(atual).set(chave, novoValor));
    setErro(null);

    alternarAcesso(tpRole, cdSecao, novoValor).then((resultado) => {
      if (resultado.erro) {
        setErro(resultado.erro);
        setEstado((atual) => new Map(atual).set(chave, !novoValor));
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Seção</th>
              {ROLES_CONFIGURAVEIS.map((role) => (
                <th key={role} className="px-3 py-2 text-center font-medium">
                  {ROLE_LABEL[role]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SECOES_ACESSO.map((secao) => (
              <tr key={secao} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-foreground">
                  {SECAO_ACESSO_LABEL[secao]}
                </td>
                {ROLES_CONFIGURAVEIS.map((role) => (
                  <td key={role} className="px-3 py-2 text-center">
                    <Checkbox
                      checked={estado.get(`${role}::${secao}`) ?? false}
                      onChange={() => alternar(role, secao)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
