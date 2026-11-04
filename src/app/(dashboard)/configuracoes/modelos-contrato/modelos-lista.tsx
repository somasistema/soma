"use client";

import { Copy, FileText, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { tipoDoModelo } from "@/lib/modelo-campos";
import { cn, formatarData } from "@/lib/utils";
import type { ModeloContrato } from "@/types/database";
import { alternarAtivoModelo, duplicarModelo, excluirModelo } from "./actions";

const COR_TIPO: Record<ReturnType<typeof tipoDoModelo>, string> = {
  Venda: "bg-sky-100 text-sky-800",
  Aluguel: "bg-emerald-100 text-emerald-800",
  Vistoria: "bg-amber-100 text-amber-800",
  Honorários: "bg-violet-100 text-violet-800",
  Outro: "bg-muted text-muted-foreground",
};

type Filtro = "ativos" | "arquivados" | "todos";

function Linha({ modelo, editavel }: { modelo: ModeloContrato; editavel: boolean }) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(modelo.sn_ativo);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const tipo = tipoDoModelo(modelo.nm_modelo);

  function alternar() {
    const novo = !ativo;
    setAtivo(novo);
    startTransition(() => alternarAtivoModelo(modelo.cd_modelo, novo));
  }

  function duplicar() {
    setErro(null);
    startTransition(async () => {
      const r = await duplicarModelo(modelo.cd_modelo);
      if ("erro" in r) setErro(r.erro);
      else router.push(`/configuracoes/modelos-contrato/${r.cd_modelo}`);
    });
  }

  function excluir() {
    if (!confirm(`Excluir o modelo "${modelo.nm_modelo}"? Isso apaga também o histórico de versões.`)) return;
    setErro(null);
    startTransition(async () => {
      const r = await excluirModelo(modelo.cd_modelo);
      if (r.erro) setErro(r.erro);
      else router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 border-t border-border px-4 py-3 first:border-t-0 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={`/configuracoes/modelos-contrato/${modelo.cd_modelo}`}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-radius hover:opacity-80"
      >
        <FileText className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-foreground">{modelo.nm_modelo}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", COR_TIPO[tipo])}>{tipo}</span>
            {!ativo && <AtivoBadge ativo={false} />}
          </span>
          {modelo.ds_descricao && (
            <span className="block text-xs text-muted-foreground">{modelo.ds_descricao}</span>
          )}
          <span className="block text-xs text-muted-foreground">
            Versão {modelo.nr_versao} · atualizado em {formatarData(modelo.ts_atualizacao)}
          </span>
        </span>
      </Link>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {erro && <p className="text-xs text-status-reprovado">{erro}</p>}
        <Link
          href={`/configuracoes/modelos-contrato/${modelo.cd_modelo}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
        >
          <Pencil className="h-3.5 w-3.5" />
          {editavel ? "Editar" : "Ver"}
        </Link>
        {editavel && (
          <>
            <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={pending} onClick={duplicar}>
              <Copy className="h-3.5 w-3.5" />
              Duplicar
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={alternar}>
              {ativo ? "Desativar" : "Ativar"}
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={pending} onClick={excluir} aria-label="Excluir">
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

export function ModelosLista({ modelos, editavel }: { modelos: ModeloContrato[]; editavel: boolean }) {
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("ativos");

  const contagem = useMemo(
    () => ({
      ativos: modelos.filter((m) => m.sn_ativo).length,
      arquivados: modelos.filter((m) => !m.sn_ativo).length,
      todos: modelos.length,
    }),
    [modelos]
  );

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return modelos.filter((m) => {
      if (filtro === "ativos" && !m.sn_ativo) return false;
      if (filtro === "arquivados" && m.sn_ativo) return false;
      return !q || m.nm_modelo.toLowerCase().includes(q) || (m.ds_descricao ?? "").toLowerCase().includes(q);
    });
  }, [modelos, busca, filtro]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar modelo..."
            className="pl-9"
            aria-label="Buscar modelo"
          />
        </div>
        <div className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs">
          {(["ativos", "arquivados", "todos"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFiltro(f)}
              aria-pressed={filtro === f}
              className={cn(
                "rounded-full px-3 py-1 font-medium capitalize transition-colors",
                filtro === f ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {f} ({contagem[f]})
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {visiveis.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {modelos.length === 0 ? "Nenhum modelo cadastrado ainda." : "Nenhum modelo com esse filtro."}
            </p>
          ) : (
            <ul>
              {visiveis.map((m) => (
                <Linha key={m.cd_modelo} modelo={m} editavel={editavel} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
