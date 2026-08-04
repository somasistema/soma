"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PacoteItem, ServicoComPrecos, TabelaCustaItem } from "@/types/database";
import { excluirPacoteItem } from "./actions";

const SECAO_LABEL: Record<PacoteItem["tp_secao_padrao"], string> = {
  inicial: "Custos Iniciais",
  final: "Custos Finais",
  ambas: "Iniciais + Finais (duplicado)",
};

function rotuloItem(item: PacoteItem, custa: TabelaCustaItem | undefined) {
  if (item.tp_origem === "itiv") return "ITIV — 3% automático";
  if (item.tp_origem === "faixa") {
    return `${item.tp_tabela_faixa} — ${item.nm_secao_faixa} (por faixa)`;
  }
  if (!custa) return "Boleto não encontrado";
  return `[${custa.tp_tabela} — ${custa.cd_ato ?? "s/ código"}] ${custa.ds_ato}`;
}

function LinhaPacoteItem({ item, custa }: { item: PacoteItem; custa: TabelaCustaItem | undefined }) {
  const [excluindo, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function excluir() {
    setErro(null);
    startTransition(async () => {
      const resultado = await excluirPacoteItem(item.cd_pacote_item);
      if (resultado.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2 first:border-t-0">
      <div className="text-sm">
        {rotuloItem(item, custa)}
        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {SECAO_LABEL[item.tp_secao_padrao]}
        </span>
        {item.sn_opcional && (
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            opcional
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {erro && <p className="text-xs text-status-reprovado">{erro}</p>}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={excluindo}
          onClick={excluir}
          aria-label="Remover vínculo"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function PacotesLista({
  pacoteItens,
  servicos,
  custas,
}: {
  pacoteItens: PacoteItem[];
  servicos: ServicoComPrecos[];
  custas: TabelaCustaItem[];
}) {
  const porServico = useMemo(() => {
    const mapa = new Map<string, PacoteItem[]>();
    for (const item of pacoteItens) {
      if (!mapa.has(item.cd_servico)) mapa.set(item.cd_servico, []);
      mapa.get(item.cd_servico)?.push(item);
    }
    return mapa;
  }, [pacoteItens]);

  const custaPorId = useMemo(() => new Map(custas.map((c) => [c.cd_custa, c])), [custas]);
  const servicoPorId = useMemo(() => new Map(servicos.map((s) => [s.cd_servico, s])), [servicos]);

  if (porServico.size === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Nenhum pacote configurado ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {Array.from(porServico.entries()).map(([cdServico, itens]) => {
        const servico = servicoPorId.get(cdServico);
        return (
          <Card key={cdServico}>
            <CardHeader>
              <CardTitle className="text-base">
                {servico ? `[${servico.tp_local}] ${servico.nm_servico}` : "Serviço não encontrado"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              {itens.map((item) => (
                <LinhaPacoteItem
                  key={item.cd_pacote_item}
                  item={item}
                  custa={item.cd_custa ? custaPorId.get(item.cd_custa) : undefined}
                />
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
