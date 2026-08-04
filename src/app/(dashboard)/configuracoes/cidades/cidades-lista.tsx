"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Cidade } from "@/types/database";
import { alternarAtivoCidade, excluirCidade } from "./actions";

function CidadeRow({ cidade }: { cidade: Cidade }) {
  const [ativo, setAtivo] = useState(cidade.sn_ativo);
  const [pendingToggle, startToggle] = useTransition();
  const [excluindo, startExclusao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    const novo = !ativo;
    setAtivo(novo);
    startToggle(() => alternarAtivoCidade(cidade.cd_cidade, novo));
  }

  function excluir() {
    if (!confirm(`Excluir "${cidade.nm_cidade}"? Preços já cadastrados pra ela continuam existindo.`))
      return;
    setErro(null);
    startExclusao(async () => {
      const resultado = await excluirCidade(cidade.cd_cidade);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <span className="text-sm text-foreground">{cidade.nm_cidade}</span>
      <div className="flex items-center gap-3">
        {erro && <p className="text-xs text-status-reprovado">{erro}</p>}
        <AtivoBadge ativo={ativo} />
        <Button type="button" variant="outline" size="sm" disabled={pendingToggle} onClick={alternar}>
          {ativo ? "Desativar" : "Ativar"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={excluindo}
          onClick={excluir}
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function CidadesLista({ cidades }: { cidades: Cidade[] }) {
  return (
    <Card>
      <CardContent className="p-0">
        {cidades.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma cidade cadastrada.
          </p>
        ) : (
          cidades.map((cidade) => <CidadeRow key={cidade.cd_cidade} cidade={cidade} />)
        )}
      </CardContent>
    </Card>
  );
}
