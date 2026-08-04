"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatarMoeda } from "@/lib/utils";
import { TABELA_CUSTA_LABEL, type TabelaCusta, type TabelaCustaItem } from "@/types/database";

function encontrarFaixa(itens: TabelaCustaItem[], base: number) {
  return itens.find(
    (item) =>
      (item.vl_faixa_min == null || base >= item.vl_faixa_min) &&
      (item.vl_faixa_max == null || base <= item.vl_faixa_max)
  );
}

// Vários atos (ITV, registro de transmissão etc.) mandam usar o MAIOR
// entre o valor da transação e o valor venal como base pra achar a
// faixa certa na tabela do cartório. Os dois valores vêm de
// Informações Básicas (opcionais, preenchidos uma vez só pro
// orçamento inteiro) — aqui só escolhe em qual tabela procurar.
export function BoletoCalculadora({
  custas,
  valorTransacao,
  valorVenal,
  onAdicionar,
}: {
  custas: TabelaCustaItem[];
  valorTransacao: number;
  valorVenal: number;
  onAdicionar: (item: { descricao: string; valor: number }) => void;
}) {
  const gruposFaixa = useMemo(() => {
    const mapa = new Map<string, { tabela: TabelaCusta; secao: string; itens: TabelaCustaItem[] }>();
    for (const custa of custas) {
      if (custa.vl_faixa_min == null && custa.vl_faixa_max == null) continue;
      const chave = `${custa.tp_tabela}::${custa.nm_secao}`;
      if (!mapa.has(chave)) {
        mapa.set(chave, { tabela: custa.tp_tabela, secao: custa.nm_secao, itens: [] });
      }
      mapa.get(chave)?.itens.push(custa);
    }
    return Array.from(mapa.values());
  }, [custas]);

  const [chaveGrupo, setChaveGrupo] = useState(() =>
    gruposFaixa[0] ? `${gruposFaixa[0].tabela}::${gruposFaixa[0].secao}` : ""
  );

  if (gruposFaixa.length === 0) return null;

  const grupoSelecionado = gruposFaixa.find((g) => `${g.tabela}::${g.secao}` === chaveGrupo);
  const base = Math.max(valorTransacao || 0, valorVenal || 0);
  const faixaEncontrada =
    grupoSelecionado && base > 0 ? encontrarFaixa(grupoSelecionado.itens, base) : undefined;

  function adicionar() {
    if (!faixaEncontrada || faixaEncontrada.vl_pagar == null) return;
    const rotulo = faixaEncontrada.cd_ato
      ? `[${faixaEncontrada.cd_ato}] ${faixaEncontrada.ds_ato}`
      : faixaEncontrada.ds_ato;
    onAdicionar({
      descricao: `${rotulo} (base: ${formatarMoeda(base)})`,
      valor: faixaEncontrada.vl_pagar,
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-3">
      <p className="text-sm font-medium text-foreground">Calculadora por valor (ITV / faixa)</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="calc_grupo">Tabela</Label>
        <Select id="calc_grupo" value={chaveGrupo} onChange={(e) => setChaveGrupo(e.target.value)}>
          {gruposFaixa.map((g) => (
            <option key={`${g.tabela}::${g.secao}`} value={`${g.tabela}::${g.secao}`}>
              {TABELA_CUSTA_LABEL[g.tabela]} — {g.secao}
            </option>
          ))}
        </Select>
      </div>

      {base > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Base de cálculo (maior valor): <strong className="text-foreground">{formatarMoeda(base)}</strong>
          </span>
          {faixaEncontrada ? (
            <span className="text-foreground">
              {faixaEncontrada.ds_ato} —{" "}
              <strong>{formatarMoeda(faixaEncontrada.vl_pagar ?? 0)}</strong>
            </span>
          ) : (
            <span className="text-status-reprovado">Nenhuma faixa encontrada pra esse valor.</span>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Preencha o valor da transação ou o valor venal em Informações Básicas pra calcular.
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!faixaEncontrada}
        onClick={adicionar}
        className="self-start"
      >
        Adicionar à conta
      </Button>
    </div>
  );
}
