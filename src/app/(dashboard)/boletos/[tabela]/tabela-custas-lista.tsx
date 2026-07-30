"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Select } from "@/components/ui/select";
import { FadeIn } from "@/components/motion/fade-in";
import type { TabelaCustaItem } from "@/types/database";
import { CustaRow } from "./custa-row";

export function TabelaCustasLista({ itens }: { itens: TabelaCustaItem[] }) {
  const secoes = useMemo(() => Array.from(new Set(itens.map((i) => i.nm_secao))), [itens]);
  const [secaoFiltro, setSecaoFiltro] = useState("");

  const itensFiltrados = secaoFiltro ? itens.filter((i) => i.nm_secao === secaoFiltro) : itens;

  return (
    <div className="flex flex-col gap-3">
      {secoes.length > 1 && (
        <Select
          value={secaoFiltro}
          onChange={(e) => setSecaoFiltro(e.target.value)}
          className="w-auto"
        >
          <option value="">Todas as seções</option>
          {secoes.map((secao) => (
            <option key={secao} value={secao}>
              {secao}
            </option>
          ))}
        </Select>
      )}

      <FadeIn className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Seção</th>
              <th className="px-4 py-3 font-medium">Ato</th>
              <th className="px-4 py-3 font-medium">Faixa de valores</th>
              <th className="px-4 py-3 text-right font-medium">Valor a pagar</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {itensFiltrados.map((item) => (
                <CustaRow key={item.cd_custa} item={item} />
              ))}
            </AnimatePresence>
            {itensFiltrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum ato cadastrado nesta seção.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </FadeIn>
    </div>
  );
}
