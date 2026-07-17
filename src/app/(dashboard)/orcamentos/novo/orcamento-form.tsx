"use client";

import { FileText, ListChecks, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatarMoeda } from "@/lib/utils";
import { TIPO_PROCESSO_LABEL, type Imobiliaria, type Servico, type TipoProcesso } from "@/types/database";
import { criarOrcamento, type ItemOrcamentoInput } from "./actions";

interface ItemLinha extends ItemOrcamentoInput {
  cd_item: string;
}

const TIPOS_PROCESSO = Object.keys(TIPO_PROCESSO_LABEL) as TipoProcesso[];

export function OrcamentoForm({
  imobiliarias,
  servicos,
}: {
  imobiliarias: Imobiliaria[];
  servicos: Servico[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [tpProcesso, setTpProcesso] = useState<TipoProcesso>(TIPOS_PROCESSO[0]);
  const [cdImobiliaria, setCdImobiliaria] = useState(imobiliarias[0]?.cd_imobiliaria ?? "");
  const [nmCompradorConvidado, setNmCompradorConvidado] = useState("");
  const [dsTelefoneComprador, setDsTelefoneComprador] = useState("");
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

  function atualizarQuantidade(cd_item: string, nr_quantidade: number) {
    setItens((atual) =>
      atual.map((item) => (item.cd_item === cd_item ? { ...item, nr_quantidade } : item))
    );
  }

  function removerItem(cd_item: string) {
    setItens((atual) => atual.filter((item) => item.cd_item !== cd_item));
  }

  function salvar() {
    setErro(null);

    if (!cdImobiliaria || !nmCompradorConvidado || !nmCidade || !dtValidade || itens.length === 0) {
      setErro("Preencha os dados do processo e adicione ao menos um serviço.");
      return;
    }

    startTransition(async () => {
      const resultado = await criarOrcamento({
        tp_processo: tpProcesso,
        cd_imobiliaria: cdImobiliaria,
        nm_comprador_convidado: nmCompradorConvidado,
        ds_telefone_comprador_convidado: dsTelefoneComprador,
        nm_cidade: nmCidade,
        dt_validade: dtValidade,
        itens: itens.map(({ cd_item: _cd_item, ...item }) => item),
      });

      if (resultado?.erro) {
        setErro(resultado.erro);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <FileText className="h-5 w-5 text-accent" />
            <CardTitle>Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tp_processo">Tipo do processo</Label>
              <Select
                id="tp_processo"
                value={tpProcesso}
                onChange={(e) => setTpProcesso(e.target.value as TipoProcesso)}
              >
                {TIPOS_PROCESSO.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_PROCESSO_LABEL[tipo]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cd_imobiliaria">Imobiliária</Label>
              <Select
                id="cd_imobiliaria"
                value={cdImobiliaria}
                onChange={(e) => setCdImobiliaria(e.target.value)}
              >
                {imobiliarias.map((imobiliaria) => (
                  <option key={imobiliaria.cd_imobiliaria} value={imobiliaria.cd_imobiliaria}>
                    {imobiliaria.nm_imobiliaria}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nm_comprador_convidado">Nome do comprador</Label>
              <Input
                id="nm_comprador_convidado"
                value={nmCompradorConvidado}
                onChange={(e) => setNmCompradorConvidado(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ds_telefone_comprador_convidado">Telefone do comprador</Label>
              <Input
                id="ds_telefone_comprador_convidado"
                value={dsTelefoneComprador}
                onChange={(e) => setDsTelefoneComprador(e.target.value)}
              />
            </div>
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
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <ListChecks className="h-5 w-5 text-accent" />
            <CardTitle>Seleção de Serviços</CardTitle>
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
                    <th className="px-3 py-2 font-medium">Qtd.</th>
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
                          min="1"
                          value={item.nr_quantidade}
                          onChange={(e) =>
                            atualizarQuantidade(item.cd_item, Number(e.target.value) || 1)
                          }
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="px-3 py-2">{formatarMoeda(item.vl_unitario)}</td>
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
          </CardContent>
        </Card>

        {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
      </div>

      <Card className="sticky top-8 border-none bg-brand text-brand-foreground">
        <CardHeader>
          <CardTitle className="text-brand-foreground">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1 text-sm text-brand-foreground/70">
            <div className="flex justify-between">
              <span>Honorários</span>
              <span>{formatarMoeda(totais.honorarios)}</span>
            </div>
            <div className="flex justify-between">
              <span>Custas</span>
              <span>{formatarMoeda(totais.custas)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 border-t border-brand-foreground/20 pt-4">
            <span className="text-xs font-medium uppercase tracking-wide text-brand-foreground/70">
              Total
            </span>
            <span className="font-serif-doc text-2xl font-semibold text-accent">
              {formatarMoeda(totais.total)}
            </span>
          </div>

          <Button
            type="button"
            onClick={salvar}
            disabled={pending}
            className="mt-2 w-full uppercase tracking-wide"
          >
            {pending ? "Salvando..." : "Criar orçamento"}
          </Button>

          <div className="flex flex-col gap-2 border-t border-brand-foreground/20 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Em breve"
              className="w-full border-brand-foreground/20 text-brand-foreground"
            >
              Gerar PDF (em breve)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled
              title="Em breve"
              className="w-full border-brand-foreground/20 text-brand-foreground"
            >
              Enviar por WhatsApp (em breve)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
