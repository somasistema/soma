"use client";

import { Receipt, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ServicoCombobox } from "@/components/servico-combobox";
import { BoletoCombobox } from "@/components/boleto-combobox";
import { formatarMoeda } from "@/lib/utils";
import {
  CIDADES_SERVICO,
  type ServicoComPrecos,
  type TabelaCustaItem,
  type TipoProcesso,
} from "@/types/database";
import type { ItemOrcamentoInput } from "@/app/(dashboard)/orcamentos/novo/actions";
import { criarOrcamentoComplementar } from "./actions";

interface ItemLinha extends ItemOrcamentoInput {
  cd_item: string;
}

export function OrcamentoComplementarForm({
  cdProcesso,
  tpProcesso,
  servicos,
  custas,
}: {
  cdProcesso: string;
  tpProcesso: TipoProcesso;
  servicos: ServicoComPrecos[];
  custas: TabelaCustaItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nmCidade, setNmCidade] = useState<string>(CIDADES_SERVICO[0]);
  const [dtValidade, setDtValidade] = useState("");
  const [itens, setItens] = useState<ItemLinha[]>([]);

  // O tipo (despachante/contrato) é herdado do processo já existente —
  // o orçamento complementar não pergunta de novo.
  const servicosDoTipo = useMemo(
    () =>
      servicos.filter((s) =>
        tpProcesso === "contrato" ? s.tp_local === "CONTRATO" : s.tp_local !== "CONTRATO"
      ),
    [servicos, tpProcesso]
  );

  const [cdServicoSelecionado, setCdServicoSelecionado] = useState(servicosDoTipo[0]?.cd_servico ?? "");
  const [cdCustaSelecionada, setCdCustaSelecionada] = useState("");

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

  function adicionarBoleto() {
    const custa = custas.find((c) => c.cd_custa === cdCustaSelecionada);
    if (!custa) return;

    setItens((atual) => [
      ...atual,
      {
        cd_item: crypto.randomUUID(),
        cd_servico: "",
        ds_descricao: custa.cd_ato ? `[${custa.cd_ato}] ${custa.ds_ato}` : custa.ds_ato,
        tp_servico: "custa",
        vl_unitario: custa.vl_pagar ?? 0,
        nr_quantidade: 1,
      },
    ]);
    setCdCustaSelecionada("");
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
        })
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
          <CardTitle>Dados do orçamento complementar</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2 space-y-0">
          <Receipt className="h-5 w-5 text-accent" />
          <CardTitle>Boletos (Custas)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="cd_custa">Boleto</Label>
              <BoletoCombobox
                custas={custas}
                value={cdCustaSelecionada}
                onChange={setCdCustaSelecionada}
              />
            </div>
            <Button type="button" variant="outline" onClick={adicionarBoleto}>
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Custas oficiais de cartório/tribunal (TJBA) — busque pelo código do ato. Quando o
            valor depende de faixa, ajuste manualmente na tabela abaixo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Itens do orçamento complementar</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[560px] text-sm">
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
