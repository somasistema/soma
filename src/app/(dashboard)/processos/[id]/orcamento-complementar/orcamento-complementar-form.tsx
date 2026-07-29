"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ServicoCombobox } from "@/components/servico-combobox";
import { formatarMoeda } from "@/lib/utils";
import {
  CIDADES_SERVICO,
  TIPO_ORCAMENTO_LABEL,
  type ServicoComPrecos,
  type TipoOrcamento,
} from "@/types/database";
import type { ItemOrcamentoInput } from "@/app/(dashboard)/orcamentos/novo/actions";
import { criarOrcamentoComplementar } from "./actions";

interface ItemLinha extends ItemOrcamentoInput {
  cd_item: string;
}

const TIPOS_ORCAMENTO = Object.keys(TIPO_ORCAMENTO_LABEL) as TipoOrcamento[];

export function OrcamentoComplementarForm({
  cdProcesso,
  servicos,
}: {
  cdProcesso: string;
  servicos: ServicoComPrecos[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [tpOrcamento, setTpOrcamento] = useState<TipoOrcamento>("despachante");
  const [nmCidade, setNmCidade] = useState<string>(CIDADES_SERVICO[0]);
  const [dtValidade, setDtValidade] = useState("");
  const [itens, setItens] = useState<ItemLinha[]>([]);

  const servicosDoTipo = useMemo(
    () =>
      servicos.filter((s) =>
        tpOrcamento === "contrato" ? s.tp_local === "CONTRATO" : s.tp_local !== "CONTRATO"
      ),
    [servicos, tpOrcamento]
  );

  const [cdServicoSelecionado, setCdServicoSelecionado] = useState(servicosDoTipo[0]?.cd_servico ?? "");

  function trocarTipoOrcamento(novoTipo: TipoOrcamento) {
    setTpOrcamento(novoTipo);
    setItens([]);
    const primeiroServico = servicos.find((s) =>
      novoTipo === "contrato" ? s.tp_local === "CONTRATO" : s.tp_local !== "CONTRATO"
    );
    setCdServicoSelecionado(primeiroServico?.cd_servico ?? "");
  }

  const totais = useMemo(() => {
    const honorarios = itens
      .filter((item) => item.tp_servico === "honorario")
      .reduce((total, item) => total + item.vl_unitario * item.nr_quantidade, 0);
    const custas = itens
      .filter((item) => item.tp_servico === "custa")
      .reduce((total, item) => total + item.vl_unitario * item.nr_quantidade, 0);
    return { honorarios, custas, total: honorarios + custas };
  }, [itens]);

  function adicionarItem() {
    const servico = servicos.find((s) => s.cd_servico === cdServicoSelecionado);
    if (!servico) return;

    const precoCidade = servico.servico_precos.find((p) => p.nm_cidade === nmCidade)?.vl_valor;

    setItens((atual) => [
      ...atual,
      {
        cd_item: crypto.randomUUID(),
        cd_servico: servico.cd_servico,
        ds_descricao: servico.nm_servico,
        tp_servico: servico.tp_servico,
        vl_unitario: precoCidade ?? 0,
        nr_quantidade: 1,
      },
    ]);
  }

  function atualizarValorUnitario(cdItem: string, vl_unitario: number) {
    setItens((atual) =>
      atual.map((item) => (item.cd_item === cdItem ? { ...item, vl_unitario } : item))
    );
  }

  function removerItem(cdItem: string) {
    setItens((atual) => atual.filter((item) => item.cd_item !== cdItem));
  }

  function salvar() {
    setErro(null);

    if (!nmCidade || !dtValidade || itens.length === 0) {
      setErro("Preencha cidade, validade e adicione ao menos um serviço.");
      return;
    }

    startTransition(async () => {
      const resultado = await criarOrcamentoComplementar(
        cdProcesso,
        nmCidade,
        dtValidade,
        itens.map(({ cd_item, ...item }) => {
          void cd_item;
          return item;
        }),
        tpOrcamento
      );

      if (resultado?.erro) {
        setErro(resultado.erro);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Tipo de orçamento</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex gap-2">
            {TIPOS_ORCAMENTO.map((tipo) => (
              <Button
                key={tipo}
                type="button"
                variant={tpOrcamento === tipo ? "default" : "outline"}
                onClick={() => trocarTipoOrcamento(tipo)}
              >
                {TIPO_ORCAMENTO_LABEL[tipo]}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Escolha única e fixa — o orçamento nunca mistura os dois tipos. Trocar aqui limpa os
            itens já selecionados abaixo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados do orçamento complementar</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nm_cidade">Cidade</Label>
            <Select id="nm_cidade" value={nmCidade} onChange={(e) => setNmCidade(e.target.value)}>
              {CIDADES_SERVICO.map((cidade) => (
                <option key={cidade} value={cidade}>
                  {cidade}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dt_validade">Validade</Label>
            <Input
              id="dt_validade"
              type="date"
              value={dtValidade}
              onChange={(e) => setDtValidade(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Serviços adicionais</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="cd_servico">Serviço</Label>
              <ServicoCombobox
                servicos={servicosDoTipo}
                nmCidade={nmCidade}
                value={cdServicoSelecionado}
                onChange={setCdServicoSelecionado}
              />
            </div>
            <Button type="button" variant="outline" onClick={adicionarItem}>
              Adicionar
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Serviço</th>
                  <th className="px-3 py-2 font-medium">Tipo</th>
                  <th className="px-3 py-2 font-medium">Valor unit.</th>
                  <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.cd_item} className="border-t border-border">
                    <td className="px-3 py-2">{item.ds_descricao}</td>
                    <td className="px-3 py-2">
                      {item.tp_servico === "honorario" ? "Honorário" : "Custa"}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.vl_unitario}
                        onChange={(e) =>
                          atualizarValorUnitario(item.cd_item, Number(e.target.value) || 0)
                        }
                        className="h-8 w-28"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatarMoeda(item.vl_unitario * item.nr_quantidade)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removerItem(item.cd_item)}
                        aria-label="Remover item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end text-sm font-semibold text-foreground">
            Total: {formatarMoeda(totais.total)}
          </div>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}

      <Button type="button" onClick={salvar} disabled={pending} className="self-start">
        {pending ? "Salvando..." : "Criar orçamento complementar"}
      </Button>
    </div>
  );
}
