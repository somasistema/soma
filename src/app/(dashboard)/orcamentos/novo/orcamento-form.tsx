"use client";

import { FileText, ListChecks, Receipt, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ServicoCombobox } from "@/components/servico-combobox";
import { BoletoCombobox } from "@/components/boleto-combobox";
import { FadeIn } from "@/components/motion/fade-in";
import { formatarMoeda, formatarTelefone } from "@/lib/utils";
import {
  CIDADES_SERVICO,
  TIPO_PROCESSO_LABEL,
  type BlocoFluxo,
  type Imobiliaria,
  type LocalServico,
  type ServicoComPrecos,
  type TabelaCustaItem,
  type TipoAplicavelFluxo,
  type TipoProcesso,
} from "@/types/database";
import { criarOrcamento, type ItemOrcamentoInput } from "./actions";

const TIPOS_PROCESSO = Object.keys(TIPO_PROCESSO_LABEL) as TipoProcesso[];

interface ItemLinha extends ItemOrcamentoInput {
  cd_item: string;
}

// Os 6 órgãos do fluxograma — "Tribunal" agrupa os 3 tribunais do
// catálogo (TJ/TRT/TRF) numa escolha só, igual no PDF. Múltipla
// escolha: dá pra marcar vários órgãos e ir somando itens de cada um
// no mesmo orçamento.
type OrgaoOrcamento = "CRI" | "NOTAS" | "RCPN" | "TRIBUNAL" | "SEDUR" | "SEFAZ";

const ORGAOS_ORCAMENTO: { chave: OrgaoOrcamento; nome: string; locais: LocalServico[] }[] = [
  { chave: "CRI", nome: "Cartório de Registro de Imóveis", locais: ["CRI"] },
  { chave: "NOTAS", nome: "Tabelionato de Notas", locais: ["NOTAS"] },
  { chave: "RCPN", nome: "Registro Civil", locais: ["RCPN"] },
  { chave: "TRIBUNAL", nome: "Tribunal", locais: ["TJ", "TRT", "TRF"] },
  { chave: "SEDUR", nome: "SEDUR", locais: ["SEDUR"] },
  { chave: "SEFAZ", nome: "SEFAZ", locais: ["SEFAZ"] },
];

export function OrcamentoForm({
  imobiliarias,
  servicos,
  custas,
  blocosAtivos,
  blocosAplicaveis,
  ordemBlocos,
}: {
  imobiliarias: Imobiliaria[];
  servicos: ServicoComPrecos[];
  custas: TabelaCustaItem[];
  blocosAtivos: Partial<Record<BlocoFluxo, boolean>>;
  blocosAplicaveis: Partial<Record<BlocoFluxo, TipoAplicavelFluxo>>;
  ordemBlocos: BlocoFluxo[];
}) {
  // Falta linha no banco (ex: migration 017 ainda não rodou) conta
  // como ativo — configurável em Configurações > Fluxo, nunca esconde
  // um bloco por omissão.
  const blocoAtivo = (bloco: BlocoFluxo) => blocosAtivos[bloco] !== false;

  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Escolha fixa e única do fluxograma. Enquanto não for feita, o
  // resto do formulário fica escondido — os campos vão aparecendo à
  // medida que a seleção avança, em vez de tudo de uma vez.
  const [tpProcesso, setTpProcesso] = useState<TipoProcesso | null>(null);
  const [cdImobiliaria, setCdImobiliaria] = useState(imobiliarias[0]?.cd_imobiliaria ?? "");
  const [nmCompradorConvidado, setNmCompradorConvidado] = useState("");
  const [dsTelefoneComprador, setDsTelefoneComprador] = useState("");
  const [nmCidade, setNmCidade] = useState<string>(CIDADES_SERVICO[0]);
  const [dtValidade, setDtValidade] = useState("");

  // Órgão / Local do Serviço (conforme fluxograma) — só existe pro
  // ramo Despachante; Contrato já é uma categoria única, sem órgão.
  // Múltipla escolha: pode marcar mais de um órgão.
  const [orgaosSelecionados, setOrgaosSelecionados] = useState<Set<OrgaoOrcamento>>(new Set());

  const [itens, setItens] = useState<ItemLinha[]>([]);

  // Só os serviços do tipo escolhido — nunca mistura Contrato com
  // Despachante no mesmo orçamento (regra validada de novo no banco).
  const servicosDoTipo = useMemo(
    () =>
      servicos.filter((s) =>
        tpProcesso === "contrato" ? s.tp_local === "CONTRATO" : s.tp_local !== "CONTRATO"
      ),
    [servicos, tpProcesso]
  );

  // Dentro do tipo, os órgãos marcados só estreitam QUAIS serviços
  // aparecem pra adicionar — não é uma escolha fixa como tipo/cidade,
  // dá pra marcar vários e ir somando itens de cada um no orçamento.
  const servicosDosOrgaos = useMemo(() => {
    if (tpProcesso === "contrato") return servicosDoTipo;
    if (orgaosSelecionados.size === 0) return [];
    const locaisAtivos = new Set(
      ORGAOS_ORCAMENTO.filter((o) => orgaosSelecionados.has(o.chave)).flatMap((o) => o.locais)
    );
    return servicosDoTipo.filter((s) => s.tp_local && locaisAtivos.has(s.tp_local));
  }, [servicosDoTipo, tpProcesso, orgaosSelecionados]);

  // Tipo de Serviço (nm_categoria) — as opções vêm do banco, não são
  // fixas: só as categorias que realmente existem dentro dos órgãos
  // marcados. Múltipla escolha, igual órgão.
  const [categoriasSelecionadas, setCategoriasSelecionadas] = useState<Set<string>>(new Set());

  const categoriasDisponiveis = useMemo(() => {
    const categorias = servicosDosOrgaos
      .map((s) => s.nm_categoria)
      .filter((categoria): categoria is string => Boolean(categoria));
    return Array.from(new Set(categorias)).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [servicosDosOrgaos]);

  // Lista final que alimenta o combobox de "Adicionar" — Contrato usa
  // servicosDosOrgaos direto (categoria única, não precisa escolher).
  const servicosParaAdicionar = useMemo(() => {
    if (tpProcesso === "contrato") return servicosDosOrgaos;
    if (categoriasSelecionadas.size === 0) return [];
    return servicosDosOrgaos.filter(
      (s) => s.nm_categoria && categoriasSelecionadas.has(s.nm_categoria)
    );
  }, [servicosDosOrgaos, tpProcesso, categoriasSelecionadas]);

  const [cdServicoSelecionado, setCdServicoSelecionado] = useState(
    servicosParaAdicionar[0]?.cd_servico ?? ""
  );

  // Boleto (custa oficial de cartório/tribunal) — bloco independente
  // dos serviços, sempre disponível: o usuário busca pelo código do
  // ato (tabela_custas) e adiciona ao mesmo orçamento.
  const [cdCustaSelecionada, setCdCustaSelecionada] = useState("");

  function escolherTipoProcesso(novoTipo: TipoProcesso) {
    setTpProcesso(novoTipo);
    setOrgaosSelecionados(new Set());
    setCategoriasSelecionadas(new Set());
    setItens([]);
    setCdServicoSelecionado("");
  }

  function alternarOrgao(chave: OrgaoOrcamento) {
    setOrgaosSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) {
        novo.delete(chave);
      } else {
        novo.add(chave);
      }
      return novo;
    });
    setCategoriasSelecionadas(new Set());
    setCdServicoSelecionado("");
  }

  function alternarCategoria(categoria: string) {
    setCategoriasSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(categoria)) {
        novo.delete(categoria);
      } else {
        novo.add(categoria);
      }
      return novo;
    });
    setCdServicoSelecionado("");
  }

  // Não depende de tpProcesso de propósito — como a ordem dos blocos
  // agora é configurável (Configurações > Fluxo), "Informações
  // Básicas" pode acabar posicionado antes de "Tipo de processo", e
  // essa checagem não pode travar esperando um bloco que vem depois.
  const dadosBasicosPreenchidos = Boolean(
    cdImobiliaria && nmCompradorConvidado && nmCidade && dtValidade
  );

  const podeSelecionarServicos = Boolean(
    tpProcesso &&
      dadosBasicosPreenchidos &&
      (tpProcesso === "contrato" ||
        (orgaosSelecionados.size > 0 && categoriasSelecionadas.size > 0))
  );

  // Um bloco só é relevante se fizer sentido pro tipo de processo
  // escolhido — configurável em Configurações > Fluxo (ex: por
  // padrão Órgão/Tipo de Serviço são só de Despachante, mas isso não
  // é mais fixo no código).
  function blocoAplicavel(bloco: BlocoFluxo) {
    const aplicavel = blocosAplicaveis[bloco] ?? "ambos";
    if (aplicavel === "ambos") return true;
    return aplicavel === tpProcesso;
  }

  // "Pronto" trava a revelação do próximo bloco na ordem — igual à
  // revelação progressiva de antes, só que agora dirigida pela ordem
  // vinda do editor de Fluxo em vez de uma sequência fixa no código.
  function blocoPronto(bloco: BlocoFluxo) {
    switch (bloco) {
      case "tipo_processo":
        return tpProcesso !== null;
      case "informacoes_basicas":
        return dadosBasicosPreenchidos;
      case "orgao":
        return orgaosSelecionados.size > 0;
      case "tipo_servico":
        return categoriasSelecionadas.size > 0;
      case "selecao_servicos":
      case "boletos":
        return true;
    }
  }

  // A ordem real de exibição — arrastar um bloco no editor de Fluxo
  // muda ordemBlocos, que muda isso aqui. Bloco desativado ou não
  // aplicável ao tipo escolhido é pulado (não trava a revelação dos
  // seguintes); o primeiro bloco aplicável que ainda não está pronto
  // é o último a aparecer por enquanto.
  const blocosVisiveis = useMemo(() => {
    const visiveis: BlocoFluxo[] = [];
    for (const bloco of ordemBlocos) {
      if (!blocoAtivo(bloco) || !blocoAplicavel(bloco)) continue;
      visiveis.push(bloco);
      if (!blocoPronto(bloco)) break;
    }
    return visiveis;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ordemBlocos,
    blocosAtivos,
    blocosAplicaveis,
    tpProcesso,
    dadosBasicosPreenchidos,
    orgaosSelecionados,
    categoriasSelecionadas,
  ]);

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
    const servico = servicosParaAdicionar.find((s) => s.cd_servico === cdServicoSelecionado);
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

  function atualizarQuantidade(cd_item: string, nr_quantidade: number) {
    setItens((atual) =>
      atual.map((item) => (item.cd_item === cd_item ? { ...item, nr_quantidade } : item))
    );
  }

  function atualizarValorUnitario(cd_item: string, vl_unitario: number) {
    setItens((atual) =>
      atual.map((item) => (item.cd_item === cd_item ? { ...item, vl_unitario } : item))
    );
  }

  function removerItem(cd_item: string) {
    setItens((atual) => atual.filter((item) => item.cd_item !== cd_item));
  }

  function salvar() {
    setErro(null);

    if (!tpProcesso || !podeSelecionarServicos || itens.length === 0) {
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

  function renderBlocoConteudo(bloco: BlocoFluxo): ReactNode {
    switch (bloco) {
      case "tipo_processo":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Tipo de processo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {TIPOS_PROCESSO.map((tipo) => (
                  <Button
                    key={tipo}
                    type="button"
                    variant={tpProcesso === tipo ? "default" : "outline"}
                    onClick={() => escolherTipoProcesso(tipo)}
                  >
                    {TIPO_PROCESSO_LABEL[tipo]}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Escolha única e fixa — o processo nunca mistura os dois tipos.
              </p>
            </CardContent>
          </Card>
        );

      case "informacoes_basicas":
        return (
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <FileText className="h-5 w-5 text-accent" />
              <CardTitle>Informações Básicas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  type="tel"
                  placeholder="(71) 99999-9999"
                  value={dsTelefoneComprador}
                  onChange={(e) => setDsTelefoneComprador(formatarTelefone(e.target.value))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nm_cidade">Cidade</Label>
                <Select id="nm_cidade" value={nmCidade} onChange={(e) => setNmCidade(e.target.value)}>
                  {CIDADES_SERVICO.map((cidade) => (
                    <option key={cidade} value={cidade}>
                      {cidade}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define o valor de cada serviço adicionado abaixo.
                </p>
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
        );

      case "orgao":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Órgão / Local do Serviço</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {ORGAOS_ORCAMENTO.map((orgao) => (
                  <Button
                    key={orgao.chave}
                    type="button"
                    variant={orgaosSelecionados.has(orgao.chave) ? "default" : "outline"}
                    onClick={() => alternarOrgao(orgao.chave)}
                  >
                    {orgao.nome}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Pode marcar mais de um órgão — os serviços de todos os marcados aparecem juntos
                abaixo pra adicionar ao orçamento.
              </p>
            </CardContent>
          </Card>
        );

      case "tipo_servico":
        return (
          <Card>
            <CardHeader>
              <CardTitle>Tipo de Serviço</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {categoriasDisponiveis.map((categoria) => (
                  <Button
                    key={categoria}
                    type="button"
                    variant={categoriasSelecionadas.has(categoria) ? "default" : "outline"}
                    onClick={() => alternarCategoria(categoria)}
                  >
                    {categoria}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Opções de acordo com os órgãos marcados acima. Pode marcar mais de um tipo.
              </p>
            </CardContent>
          </Card>
        );

      case "selecao_servicos":
        return (
          <Card>
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <ListChecks className="h-5 w-5 text-accent" />
              <CardTitle>Seleção de Serviços</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="cd_servico">Serviço</Label>
                <ServicoCombobox
                  servicos={servicosParaAdicionar}
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
        );

      case "boletos":
        return (
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
        );
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-6 lg:col-span-2">
        {blocosVisiveis.map((bloco) => (
          <FadeIn key={bloco}>{renderBlocoConteudo(bloco)}</FadeIn>
        ))}

        {podeSelecionarServicos && itens.length > 0 && (
          <FadeIn>
            <Card>
              <CardHeader>
                <CardTitle>Itens do orçamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full min-w-[640px] text-sm">
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
              </CardContent>
            </Card>
          </FadeIn>
        )}

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
            disabled={pending || !podeSelecionarServicos || itens.length === 0}
            className="mt-2 w-full uppercase tracking-wide"
          >
            {pending ? "Salvando..." : "Criar orçamento"}
          </Button>
          <p className="text-xs text-brand-foreground/70">
            PDF e envio por WhatsApp ficam disponíveis na página do orçamento após criá-lo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
