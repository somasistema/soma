"use client";

import { Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Imobiliaria } from "@/types/database";
import { alternarAtivoImobiliaria } from "./actions";
import { ImobiliariaForm } from "./imobiliaria-form";

function ImobiliariaRow({ imobiliaria, editavel }: { imobiliaria: Imobiliaria; editavel: boolean }) {
  const [editando, setEditando] = useState(false);
  const [ativo, setAtivo] = useState(imobiliaria.sn_ativo);
  const [pendingToggle, startToggle] = useTransition();

  function alternar() {
    const novo = !ativo;
    setAtivo(novo);
    startToggle(() => alternarAtivoImobiliaria(imobiliaria.cd_imobiliaria, novo));
  }

  const detalhes = [
    imobiliaria.ds_cnpj && `CNPJ ${imobiliaria.ds_cnpj}`,
    imobiliaria.ds_creci && `CRECI-PJ ${imobiliaria.ds_creci}`,
    imobiliaria.ds_endereco,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{imobiliaria.nm_imobiliaria}</p>
          {detalhes.length > 0 ? (
            <p className="text-xs text-muted-foreground">{detalhes.join(" · ")}</p>
          ) : (
            <p className="text-xs text-status-pendente">
              Sem CNPJ/CRECI/endereço — o contrato sai com lacunas.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
            </>
          )}
        </div>
      </div>
      {editando && (
        <ImobiliariaForm imobiliaria={imobiliaria} onPronto={() => setEditando(false)} />
      )}
    </div>
  );
}

export function ImobiliariasLista({
  imobiliarias,
  editavel,
}: {
  imobiliarias: Imobiliaria[];
  editavel: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {imobiliarias.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma imobiliária cadastrada.
          </p>
        ) : (
          imobiliarias.map((i) => (
            <ImobiliariaRow key={i.cd_imobiliaria} imobiliaria={i} editavel={editavel} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
