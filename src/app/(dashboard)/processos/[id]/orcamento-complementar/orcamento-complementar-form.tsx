"use client";

import { Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatarMoeda } from "@/lib/utils";
import type { Servico } from "@/types/database";
import type { ItemOrcamentoInput } from "@/app/(dashboard)/orcamentos/novo/actions";
import { criarOrcamentoComplementar } from "./actions";

interface ItemLinha extends ItemOrcamentoInput {
  cd_item: string;
}

export function OrcamentoComplementarForm({
  cdProcesso,
  servicos,
}: {
  cdProcesso: string;
  servicos: Servico[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nmCidade, setNmCidade] = useState("");
  const [dtValidade, setDtValidade] = useState("");
  const [cdServicoSelecionado, setCdServicoSelecionado] = useState(servicos[0]?.cd_servico ?? "");
  const [itens, setItens] = useState<ItemLinha[]>([]);

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

    setItens((atual) => [
      ...atual,
      {
        cd_item: crypto.randomUUID(),
        cd_servico: servico.cd_servico,
        ds_descricao: servico.nm_servico,
        tp_servico: servico.tp_servico,
        vl_unitario: servico.vl_servico,
        nr_quantidade: 1,
      },
    ]);
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
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nm_cidade">Cidade</Label>
            <Input id="nm_cidade" value={nmCidade} onChange={(e) => setNmCidade(e.target.value)} />
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
              <Select
                id="cd_servico"
                value={cdServicoSelecionado}
                onChange={(e) => setCdServicoSelecionado(e.target.value)}
              >
                {servicos.map((servico) => (
                  <option key={servico.cd_servico} value={servico.cd_servico}>
                    {servico.nm_servico} — {formatarMoeda(servico.vl_servico)}
                  </option>
                ))}
              </Select>
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
