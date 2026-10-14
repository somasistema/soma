"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Corretor } from "@/types/database";
import { alternarAtivoCorretor, excluirCorretor } from "./actions";
import { CorretorForm } from "./corretor-form";

function CorretorRow({ corretor, editavel }: { corretor: Corretor; editavel: boolean }) {
  const [editando, setEditando] = useState(false);
  const [ativo, setAtivo] = useState(corretor.sn_ativo);
  const [pendingToggle, startToggle] = useTransition();
  const [excluindo, startExclusao] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function alternar() {
    const novo = !ativo;
    setAtivo(novo);
    startToggle(() => alternarAtivoCorretor(corretor.cd_corretor, novo));
  }

  function excluir() {
    if (!confirm(`Excluir "${corretor.nm_corretor}" do cadastro? Processos antigos continuam com o nome.`))
      return;
    setErro(null);
    startExclusao(async () => {
      const r = await excluirCorretor(corretor.cd_corretor);
      if (r.erro) setErro(r.erro);
    });
  }

  const detalhes = [
    corretor.ds_cpf && `CPF ${corretor.ds_cpf}`,
    corretor.dt_nascimento &&
      `nasc. ${corretor.dt_nascimento.slice(0, 10).split("-").reverse().join("/")}`,
    corretor.ds_creci && `CRECI ${corretor.ds_creci}`,
    corretor.ds_telefone,
    corretor.ds_email,
    corretor.ds_pix && `PIX ${corretor.ds_pix}`,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{corretor.nm_corretor}</p>
          {detalhes.length > 0 && (
            <p className="text-xs text-muted-foreground">{detalhes.join(" · ")}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {erro && <p className="text-xs text-status-reprovado">{erro}</p>}
          <AtivoBadge ativo={ativo} />
          {editavel && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setEditando((v) => !v)}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
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
            </>
          )}
        </div>
      </div>
      {editando && <CorretorForm corretor={corretor} onPronto={() => setEditando(false)} />}
    </div>
  );
}

export function CorretoresLista({
  corretores,
  editavel,
}: {
  corretores: Corretor[];
  editavel: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {corretores.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum corretor cadastrado ainda.
          </p>
        ) : (
          corretores.map((c) => <CorretorRow key={c.cd_corretor} corretor={c} editavel={editavel} />)
        )}
      </CardContent>
    </Card>
  );
}
