"use client";

import { Pencil, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ServicoComPrecos } from "@/types/database";
import { formatarMoeda } from "@/lib/utils";
import { atualizarServico, excluirServico } from "../actions";
import { ToggleAtivo } from "../toggle-ativo";

function precoPorCidade(servico: ServicoComPrecos, cidade: string) {
  return servico.servico_precos.find((p) => p.nm_cidade === cidade)?.vl_valor;
}

export function ServicoRow({
  servico,
  cidades,
}: {
  servico: ServicoComPrecos;
  cidades: string[];
}) {
  const [editando, setEditando] = useState(false);
  const [valorVariavel, setValorVariavel] = useState(servico.sn_valor_variavel);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, startExclusao] = useTransition();
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  function salvar(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const resultado = await atualizarServico(servico.cd_servico, null, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
      } else {
        setEditando(false);
      }
    });
  }

  function excluir() {
    if (!confirm(`Excluir "${servico.nm_servico}"? Essa ação não pode ser desfeita.`)) return;
    setErroExclusao(null);
    startExclusao(async () => {
      const resultado = await excluirServico(servico.cd_servico);
      if (resultado.erro) setErroExclusao(resultado.erro);
    });
  }

  if (editando) {
    return (
      <motion.tr layout className="border-t border-border bg-muted/30">
        <td colSpan={cidades.length + 5} className="px-4 py-4">
          <form action={salvar} className="flex flex-col gap-3">
            <input type="hidden" name="tp_local" value={servico.tp_local ?? ""} />
            <input type="hidden" name="qtd_cidades" value={cidades.length} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input name="cd_codigo" placeholder="Código" defaultValue={servico.cd_codigo ?? ""} />
              <Input
                name="nm_categoria"
                placeholder="Categoria"
                defaultValue={servico.nm_categoria ?? ""}
                required
              />
              <Input
                name="nm_servico"
                placeholder="Descrição"
                defaultValue={servico.nm_servico}
                required
                className="sm:col-span-2"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                name="sn_valor_variavel"
                defaultChecked={valorVariavel}
                onChange={(e) => setValorVariavel(e.target.checked)}
              />
              Valor variável (sem preço fixo)
            </label>
            {!valorVariavel && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {cidades.map((cidade) => (
                  <Input
                    key={cidade}
                    name={`preco__${cidade}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={cidade}
                    defaultValue={precoPorCidade(servico, cidade) ?? ""}
                  />
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
            </div>
          </form>
        </td>
      </motion.tr>
    );
  }

  return (
    <motion.tr
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
        <td colSpan={cidades.length} className="px-4 py-3 italic text-muted-foreground">
          Valor variável
        </td>
      ) : (
        cidades.map((cidade) => {
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
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setEditando(true)}
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
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
          <ToggleAtivo cd_servico={servico.cd_servico} sn_ativo={servico.sn_ativo} />
        </div>
        {erroExclusao && <p className="mt-1 text-xs text-status-reprovado">{erroExclusao}</p>}
      </td>
    </motion.tr>
  );
}
