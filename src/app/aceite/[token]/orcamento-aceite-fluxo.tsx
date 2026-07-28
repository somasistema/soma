"use client";

import { useMemo, useState, useTransition } from "react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { formatarMoeda } from "@/lib/utils";
import type { OrcamentoAceiteItem } from "@/types/database";
import { TermoDespachanteBox } from "./termo-despachante-box";
import { aceitarOrcamento } from "./actions";

export function OrcamentoAceiteFluxo({
  token,
  itens,
}: {
  token: string;
  itens: OrcamentoAceiteItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [termoAceito, setTermoAceito] = useState(false);
  const [selecionados, setSelecionados] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(itens.map((item) => [item.cd_orcamento_servico, item.sn_selecionado]))
  );

  const totais = useMemo(() => {
    return itens.reduce(
      (acc, item) => {
        if (!selecionados[item.cd_orcamento_servico]) return acc;
        if (item.tp_servico === "honorario") acc.honorarios += item.vl_subtotal;
        else acc.custas += item.vl_subtotal;
        acc.total += item.vl_subtotal;
        return acc;
      },
      { honorarios: 0, custas: 0, total: 0 }
    );
  }, [itens, selecionados]);

  const nenhumItemSelecionado = Object.values(selecionados).every((v) => !v);

  function alternarItem(cdOrcamentoServico: string) {
    setSelecionados((atual) => ({
      ...atual,
      [cdOrcamentoServico]: !atual[cdOrcamentoServico],
    }));
  }

  function aceitar() {
    setErro(null);

    const idsSelecionados = Object.entries(selecionados)
      .filter(([, marcado]) => marcado)
      .map(([id]) => id);

    if (idsSelecionados.length === 0) {
      setErro("Selecione ao menos um item do orçamento para aceitar.");
      return;
    }

    if (!termoAceito) {
      setErro("Confirme a ciência do Termo de Ciência e Aceite dos Serviços de Despachante.");
      return;
    }

    startTransition(async () => {
      const resultado = await aceitarOrcamento(token, idsSelecionados, termoAceito);

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="w-8 py-2" />
              <th className="py-2 font-medium">Serviço</th>
              <th className="py-2 font-medium">Tipo</th>
              <th className="py-2 font-medium">Qtd.</th>
              <th className="py-2 font-medium">Valor unit.</th>
              <th className="py-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((item) => (
              <motion.tr
                key={item.cd_orcamento_servico}
                animate={{ opacity: selecionados[item.cd_orcamento_servico] ? 1 : 0.4 }}
                transition={{ duration: 0.2 }}
                className="border-t border-border"
              >
                <td className="py-2">
                  <Checkbox
                    checked={!!selecionados[item.cd_orcamento_servico]}
                    onChange={() => alternarItem(item.cd_orcamento_servico)}
                    disabled={pending}
                    aria-label={`Selecionar ${item.ds_descricao}`}
                  />
                </td>
                <td className="py-2">{item.ds_descricao}</td>
                <td className="py-2">{item.tp_servico === "honorario" ? "Honorário" : "Custa"}</td>
                <td className="py-2">{item.nr_quantidade}</td>
                <td className="py-2">{formatarMoeda(item.vl_unitario)}</td>
                <td className="py-2 text-right">{formatarMoeda(item.vl_subtotal)}</td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
          <p className="text-muted-foreground">Honorários selecionados: {formatarMoeda(totais.honorarios)}</p>
          <p className="text-muted-foreground">Custas selecionadas: {formatarMoeda(totais.custas)}</p>
          <motion.p
            key={totais.total}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="font-serif-doc text-lg font-semibold text-foreground"
          >
            Total a aceitar: {formatarMoeda(totais.total)}
          </motion.p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <TermoDespachanteBox />
        <label className="flex items-start gap-2 text-sm text-foreground">
          <Checkbox
            checked={termoAceito}
            onChange={(e) => setTermoAceito(e.target.checked)}
            disabled={pending}
            className="mt-0.5"
          />
          <span>
            Li e concordo integralmente com o Termo de Ciência e Aceite dos Serviços de
            Despachante acima.
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={aceitar}
          disabled={pending || nenhumItemSelecionado || !termoAceito}
          className="self-start"
        >
          {pending ? "Registrando aceite..." : "Aceitar orçamento"}
        </Button>
        {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
      </div>
    </div>
  );
}
