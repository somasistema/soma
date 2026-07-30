"use client";

import { Pencil, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatarMoeda } from "@/lib/utils";
import type { TabelaCustaItem } from "@/types/database";
import { atualizarCusta, excluirCusta } from "../actions";

function rotuloFaixa(item: TabelaCustaItem) {
  if (item.vl_faixa_min == null && item.vl_faixa_max == null) return "—";
  if (item.vl_faixa_min == null) return `Até ${formatarMoeda(item.vl_faixa_max!)}`;
  if (item.vl_faixa_max == null) return `A partir de ${formatarMoeda(item.vl_faixa_min)}`;
  return `${formatarMoeda(item.vl_faixa_min)} a ${formatarMoeda(item.vl_faixa_max)}`;
}

export function CustaRow({ item }: { item: TabelaCustaItem }) {
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, startExclusao] = useTransition();
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  function salvar(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const resultado = await atualizarCusta(item.cd_custa, null, formData);
      if (resultado?.erro) {
        setErro(resultado.erro);
      } else {
        setEditando(false);
      }
    });
  }

  function excluir() {
    if (!confirm(`Excluir "${item.ds_ato}"? Essa ação não pode ser desfeita.`)) return;
    setErroExclusao(null);
    startExclusao(async () => {
      const resultado = await excluirCusta(item.cd_custa);
      if (resultado.erro) setErroExclusao(resultado.erro);
    });
  }

  if (editando) {
    return (
      <motion.tr layout className="border-t border-border bg-muted/30">
        <td colSpan={6} className="px-4 py-4">
          <form action={salvar} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input name="cd_ato" placeholder="Código do ato" defaultValue={item.cd_ato ?? ""} />
              <Input
                name="nm_secao"
                placeholder="Seção"
                defaultValue={item.nm_secao}
                required
                className="sm:col-span-2"
              />
            </div>
            <Input name="ds_ato" placeholder="Descrição do ato" defaultValue={item.ds_ato} required />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input
                name="vl_faixa_min"
                type="number"
                step="0.01"
                min="0"
                placeholder="Faixa — de (R$)"
                defaultValue={item.vl_faixa_min ?? ""}
              />
              <Input
                name="vl_faixa_max"
                type="number"
                step="0.01"
                min="0"
                placeholder="Faixa — até (R$)"
                defaultValue={item.vl_faixa_max ?? ""}
              />
              <Input
                name="vl_pagar"
                type="number"
                step="0.01"
                min="0"
                placeholder="Valor a pagar (R$)"
                defaultValue={item.vl_pagar ?? ""}
              />
              <Input
                name="ds_valor_especial"
                placeholder="Valor especial (Gratuita, Isento...)"
                defaultValue={item.ds_valor_especial ?? ""}
              />
            </div>
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
      <td className="px-4 py-3 text-muted-foreground">{item.cd_ato ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{item.nm_secao}</td>
      <td className="px-4 py-3">{item.ds_ato}</td>
      <td className="px-4 py-3 text-muted-foreground">{rotuloFaixa(item)}</td>
      <td className="px-4 py-3 text-right">
        {item.ds_valor_especial ?? (item.vl_pagar != null ? formatarMoeda(item.vl_pagar) : "—")}
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
        </div>
        {erroExclusao && <p className="mt-1 text-xs text-status-reprovado">{erroExclusao}</p>}
      </td>
    </motion.tr>
  );
}
