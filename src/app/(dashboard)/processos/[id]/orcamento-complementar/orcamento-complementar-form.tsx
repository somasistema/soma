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
import { BoletoCalculadora } from "@/components/boleto-calculadora";
import { formatarMoeda } from "@/lib/utils";
import type { PacoteItem, ServicoComPrecos, TabelaCustaItem, TipoProcesso } from "@/types/database";
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
  cidades,
  pacoteItens,
}: {
  cdProcesso: string;
  tpProcesso: TipoProcesso;
  servicos: ServicoComPrecos[];
  custas: TabelaCustaItem[];
  cidades: string[];
  pacoteItens: PacoteItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nmCidade, setNmCidade] = useState<string>(cidades[0] ?? "");
  const [dtValidade, setDtValidade] = useState("");
  const [dsInscricaoMunicipal, setDsInscricaoMunicipal] = useState("");
  const [valorTransacao, setValorTransacao] = useState("");
  const [valorVenal, setValorVenal] = useState("");
  const baseCalculo = Math.max(Number(valorTransacao) || 0, Number(valorVenal) || 0);
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

    const boletosDoPacote = pacoteItens
      .filter((p) => p.cd_servico === servico.cd_servico)
      .map((p) => custas.find((c) => c.cd_custa === p.cd_custa))
      .filter((c): c is TabelaCustaItem => Boolean(c));

    setItens((atual) => [
      ...atual,
      {
        cd_item: crypto.randomUUID(),
        cd_servico: servico.cd_servico,
        ds_descricao: servico.nm_servico,
        tp_servico: servico.tp_servico,
        tp_secao: "inicial",
        vl_unitario: precoCidade ?? 0,
        nr_quantidade: 1,
      },
      ...boletosDoPacote.map((custa) => {
        const opcional = pacoteItens.find(
          (p) => p.cd_servico === servico.cd_servico && p.cd_custa === custa.cd_custa
        )?.sn_opcional;
        const rotulo = custa.cd_ato ? `[${custa.cd_ato}] ${custa.ds_ato}` : custa.ds_ato;
        return {
          cd_item: crypto.randomUUID(),
          cd_servico: "",
          ds_descricao: opcional ? `${rotulo} (opcional)` : rotulo,
          tp_servico: "custa" as const,
          tp_secao: "inicial" as const,
          vl_unitario: custa.vl_pagar ?? 0,
          nr_quantidade: 1,
        };
      }),
    ]);
  }

  function atualizarValorUnitario(cdItem: string, vl_unitario: number) {
    setItens((atual) =>
      atual.map((item) => (item.cd_item === cdItem ? { ...item, vl_unitario } : item))
    );
  }

  function atualizarSecao(cdItem: string, tp_secao: "inicial" | "final") {
    setItens((atual) =>
      atual.map((item) => (item.cd_item === cdItem ? { ...item, tp_secao } : item))
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
        tp_secao: "inicial",
        vl_unitario: custa.vl_pagar ?? 0,
        nr_quantidade: 1,
      },
    ]);
    setCdCustaSelecionada("");
  }

  function adicionarBoletoCalculado(item: { descricao: string; valor: number }) {
    setItens((atual) => [
      ...atual,
      {
        cd_item: crypto.randomUUID(),
        cd_servico: "",
        ds_descricao: item.descricao,
        tp_servico: "custa",
        tp_secao: "inicial",
        vl_unitario: item.valor,
        nr_quantidade: 1,
      },
    ]);
  }

  function adicionarItiv() {
    if (baseCalculo <= 0) return;
    setItens((atual) => [
      ...atual,
      {
        cd_item: crypto.randomUUID(),
        cd_servico: "",
        ds_descricao: `ITIV — 3% sobre ${formatarMoeda(baseCalculo)} (maior valor entre transação e venal)`,
        tp_servico: "custa",
        tp_secao: "inicial",
        vl_unitario: Math.round(baseCalculo * 0.03 * 100) / 100,
        nr_quantidade: 1,
      },
    ]);
  }

  function encontrarFaixaCusta(tpTabela: TabelaCustaItem["tp_tabela"], nmSecao: string) {
    return custas.find(
      (c) =>
        c.tp_tabela === tpTabela &&
        c.nm_secao === nmSecao &&
        (c.vl_faixa_min == null || baseCalculo >= c.vl_faixa_min) &&
        (c.vl_faixa_max == null || baseCalculo <= c.vl_faixa_max)
    );
  }

  function adicionarPacoteCompraVenda() {
    if (baseCalculo <= 0) return;
    const novosItens: ItemLinha[] = [
      {
        cd_item: crypto.randomUUID(),
        cd_servico: "",
        ds_descricao: `ITIV — 3% sobre ${formatarMoeda(baseCalculo)}`,
        tp_servico: "custa",
        tp_secao: "inicial",
        vl_unitario: Math.round(baseCalculo * 0.03 * 100) / 100,
        nr_quantidade: 1,
      },
    ];

    const lavratura = encontrarFaixaCusta("NOTAS", "I - Atos com Valor Econômico");
    if (lavratura?.vl_pagar != null) {
      novosItens.push({
        cd_item: crypto.randomUUID(),
        cd_servico: "",
        ds_descricao: `Lavratura de Escritura — ${lavratura.ds_ato}`,
        tp_servico: "custa",
        tp_secao: "inicial",
        vl_unitario: lavratura.vl_pagar,
        nr_quantidade: 1,
      });
    }

    const registro = encontrarFaixaCusta("RI", "I - Atos com Valor Econômico");
    if (registro?.vl_pagar != null) {
      novosItens.push({
        cd_item: crypto.randomUUID(),
        cd_servico: "",
        ds_descricao: `Registro do Título — ${registro.ds_ato}`,
        tp_servico: "custa",
        tp_secao: "final",
        vl_unitario: registro.vl_pagar,
        nr_quantidade: 1,
      });
    }

    const prenotacao = custas.find((c) => c.tp_tabela === "RI" && c.cd_ato === "13043");
    if (prenotacao?.vl_pagar != null) {
      novosItens.push(
        {
          cd_item: crypto.randomUUID(),
          cd_servico: "",
          ds_descricao: `Prenotação (1ª) — ${prenotacao.ds_ato}`,
          tp_servico: "custa",
          tp_secao: "inicial",
          vl_unitario: prenotacao.vl_pagar,
          nr_quantidade: 1,
        },
        {
          cd_item: crypto.randomUUID(),
          cd_servico: "",
          ds_descricao: `Prenotação (2ª) — ${prenotacao.ds_ato}`,
          tp_servico: "custa",
          tp_secao: "final",
          vl_unitario: prenotacao.vl_pagar,
          nr_quantidade: 1,
        }
      );
    }

    const certidaoOnus = custas.find((c) => c.tp_tabela === "RI" && c.cd_ato === "13042");
    if (certidaoOnus?.vl_pagar != null) {
      novosItens.push({
        cd_item: crypto.randomUUID(),
        cd_servico: "",
        ds_descricao: `Certidão de Ônus (proxy) — ${certidaoOnus.ds_ato}`,
        tp_servico: "custa",
        tp_secao: "inicial",
        vl_unitario: certidaoOnus.vl_pagar,
        nr_quantidade: 1,
      });
    }

    setItens((atual) => [...atual, ...novosItens]);
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
        dsInscricaoMunicipal,
        valorTransacao ? Number(valorTransacao) : null,
        valorVenal ? Number(valorVenal) : null
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
              {cidades.map((cidade) => (
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ds_inscricao_municipal">Inscrição Municipal do imóvel (opcional)</Label>
            <Input
              id="ds_inscricao_municipal"
              value={dsInscricaoMunicipal}
              onChange={(e) => setDsInscricaoMunicipal(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor_transacao">Valor da transação (opcional)</Label>
            <Input
              id="valor_transacao"
              type="number"
              min="0"
              step="0.01"
              value={valorTransacao}
              onChange={(e) => setValorTransacao(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="valor_venal">Valor venal (opcional)</Label>
            <Input
              id="valor_venal"
              type="number"
              min="0"
              step="0.01"
              value={valorVenal}
              onChange={(e) => setValorVenal(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Usados na calculadora de boleto por faixa (ITV) abaixo — o sistema usa sempre o
              maior dos dois.
            </p>
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
            Custas oficiais de cartório/tribunal (TJBA) — busque pelo código do ato, ou use as
            ferramentas abaixo pra Compra e Venda (ITIV, Lavratura, Registro).
          </p>

          {baseCalculo > 0 && (
            <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
              <p className="text-sm font-medium text-foreground">Compra e Venda</p>
              <p className="text-xs text-muted-foreground">
                Base de cálculo: <strong>{formatarMoeda(baseCalculo)}</strong> (maior valor entre
                transação e venal)
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={adicionarItiv}>
                  Adicionar ITIV (3%)
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={adicionarPacoteCompraVenda}>
                  Adicionar pacote completo (ITIV + Lavratura + Registro + Prenotação x2 +
                  Certidão)
                </Button>
              </div>
            </div>
          )}

          <BoletoCalculadora
            custas={custas}
            valorTransacao={Number(valorTransacao) || 0}
            valorVenal={Number(valorVenal) || 0}
            onAdicionar={adicionarBoletoCalculado}
          />
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
                  <th className="px-3 py-2 font-medium">Seção</th>
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
                      <Select
                        value={item.tp_secao}
                        onChange={(e) =>
                          atualizarSecao(item.cd_item, e.target.value as "inicial" | "final")
                        }
                        className="h-8 w-24 px-2 text-xs"
                      >
                        <option value="inicial">Inicial</option>
                        <option value="final">Final</option>
                      </Select>
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
