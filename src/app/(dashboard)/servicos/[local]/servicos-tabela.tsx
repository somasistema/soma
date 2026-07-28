"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Select } from "@/components/ui/select";
import { FadeIn } from "@/components/motion/fade-in";
import { CIDADES_SERVICO, type ServicoComPrecos } from "@/types/database";
import { formatarMoeda } from "@/lib/utils";
import { ToggleAtivo } from "../toggle-ativo";

export function ServicosTabela({ servicos }: { servicos: ServicoComPrecos[] }) {
  const categorias = useMemo(
    () => Array.from(new Set(servicos.map((s) => s.nm_categoria).filter(Boolean))) as string[],
    [servicos]
  );
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  const servicosFiltrados = categoriaFiltro
    ? servicos.filter((s) => s.nm_categoria === categoriaFiltro)
    : servicos;

  function precoPorCidade(servico: ServicoComPrecos, cidade: string) {
    return servico.servico_precos.find((p) => p.nm_cidade === cidade)?.vl_valor;
  }

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
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Código</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Descrição</th>
              {CIDADES_SERVICO.map((cidade) => (
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
                <motion.tr
                  key={servico.cd_servico}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="border-t border-border hover:bg-muted/50"
                >
                  <td className="px-4 py-3 text-muted-foreground">{servico.cd_codigo}</td>
                  <td className="px-4 py-3 text-muted-foreground">{servico.nm_categoria}</td>
                  <td className="px-4 py-3">{servico.nm_servico}</td>
                  {servico.sn_valor_variavel ? (
                    <td colSpan={CIDADES_SERVICO.length} className="px-4 py-3 italic text-muted-foreground">
                      Valor variável
                    </td>
                  ) : (
                    CIDADES_SERVICO.map((cidade) => {
                      const valor = precoPorCidade(servico, cidade);
                      return (
                        <td key={cidade} className="px-4 py-3">
                          {valor != null ? formatarMoeda(valor) : "—"}
                        </td>
                      );
                    })
                  )}
                  <td className="px-4 py-3">
                    <AtivoBadge ativo={servico.sn_ativo} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ToggleAtivo cd_servico={servico.cd_servico} sn_ativo={servico.sn_ativo} />
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
            {servicosFiltrados.length === 0 && (
              <tr>
                <td colSpan={CIDADES_SERVICO.length + 5} className="px-4 py-6 text-center text-muted-foreground">
                  Nenhum serviço cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </FadeIn>
    </div>
  );
}
