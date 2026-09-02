"use client";

import { ChevronDown, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ModeloContrato } from "@/types/database";
import { alternarAtivoModelo, excluirModelo } from "./actions";
import { ModeloEditor } from "./modelo-editor";

function ModeloRow({ modelo, editavel }: { modelo: ModeloContrato; editavel: boolean }) {
  const [ativo, setAtivo] = useState(modelo.sn_ativo);
  const [aberto, setAberto] = useState(false);
  const [pendingToggle, startToggle] = useTransition();
  const [excluindo, startExclusao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    const novo = !ativo;
    setAtivo(novo);
    startToggle(() => alternarAtivoModelo(modelo.cd_modelo, novo));
  }

  function excluir() {
    if (!confirm(`Excluir o modelo "${modelo.nm_modelo}"? Isso apaga também o histórico de versões.`))
      return;
    setErro(null);
    startExclusao(async () => {
      const resultado = await excluirModelo(modelo.cd_modelo);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="border-t border-border first:border-t-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">{modelo.nm_modelo}</span>
            {modelo.ds_descricao && (
              <span className="block truncate text-xs text-muted-foreground">
                {modelo.ds_descricao}
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-3">
          {erro && <p className="text-xs text-status-reprovado">{erro}</p>}
          <span className="text-xs text-muted-foreground">v{modelo.nr_versao}</span>
          <AtivoBadge ativo={ativo} />
          {editavel && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendingToggle}
                onClick={alternar}
              >
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
            </>
          )}
        </div>
      </div>
      {aberto && (
        <div className="border-t border-border bg-muted/30 p-4">
          {editavel ? (
            <ModeloEditor modelo={modelo} onPronto={() => setAberto(false)} />
          ) : (
            <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground">
              {modelo.ds_conteudo}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export function ModelosLista({
  modelos,
  editavel,
}: {
  modelos: ModeloContrato[];
  editavel: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {modelos.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum modelo cadastrado ainda.
          </p>
        ) : (
          modelos.map((modelo) => (
            <ModeloRow key={modelo.cd_modelo} modelo={modelo} editavel={editavel} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
