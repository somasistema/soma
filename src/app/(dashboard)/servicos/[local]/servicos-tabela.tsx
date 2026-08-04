"use client";

import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import { Select } from "@/components/ui/select";
import { FadeIn } from "@/components/motion/fade-in";
import type { ServicoComPrecos } from "@/types/database";
import { ServicoRow } from "./servico-row";

export function ServicosTabela({
  servicos,
  cidades,
}: {
  servicos: ServicoComPrecos[];
  cidades: string[];
}) {
  const categorias = useMemo(
    () => Array.from(new Set(servicos.map((s) => s.nm_categoria).filter(Boolean))) as string[],
    [servicos]
  );
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  const servicosFiltrados = categoriaFiltro
    ? servicos.filter((s) => s.nm_categoria === categoriaFiltro)
    : servicos;

  return (
    <div className="flex flex-col gap-3">
      {categorias.length > 1 && (
        <div className="flex items-center gap-2">
          <Select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="w-auto"
          >
            <option value="">Todas as categorias</option>
            {categorias.map((categoria) => (
              <option key={categoria} value={categoria}>
                {categoria}
              </option>
            ))}
          </Select>
        </div>
      )}

      <FadeIn className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[840px] text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              {cidades.map((cidade) => (
                <th key={cidade} className="px-4 py-3 font-medium">
                  {cidade}
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {servicosFiltrados.map((servico) => (
                <ServicoRow key={servico.cd_servico} servico={servico} cidades={cidades} />
              ))}
            </AnimatePresence>
            {servicosFiltrados.length === 0 && (
              <tr>
                <td colSpan={cidades.length + 5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum serviço cadastrado.
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
