"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Select } from "@/components/ui/select";
import { FadeIn } from "@/components/motion/fade-in";
import { formatarMoeda } from "@/lib/utils";
import type { TabelaCustaItem } from "@/types/database";

function rotuloFaixa(item: TabelaCustaItem) {
  if (item.vl_faixa_min == null && item.vl_faixa_max == null) return "—";
  if (item.vl_faixa_min == null) return `Até ${formatarMoeda(item.vl_faixa_max!)}`;
  if (item.vl_faixa_max == null) return `A partir de ${formatarMoeda(item.vl_faixa_min)}`;
  return `${formatarMoeda(item.vl_faixa_min)} a ${formatarMoeda(item.vl_faixa_max)}`;
}

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
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {itensFiltrados.map((item) => (
                <motion.tr
                  key={item.cd_custa}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="border-t border-border hover:bg-muted/50"
                >
                  <td className="px-4 py-3 text-muted-foreground">{item.cd_ato ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.nm_secao}</td>
                  <td className="px-4 py-3">{item.ds_ato}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rotuloFaixa(item)}</td>
                  <td className="px-4 py-3 text-right">
                    {item.ds_valor_especial ?? (item.vl_pagar != null ? formatarMoeda(item.vl_pagar) : "—")}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {itensFiltrados.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
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
