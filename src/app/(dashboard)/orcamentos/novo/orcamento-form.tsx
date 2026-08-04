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
import { BoletoCalculadora } from "@/components/boleto-calculadora";
import { FadeIn } from "@/components/motion/fade-in";
import { formatarMoeda, formatarTelefone } from "@/lib/utils";
import {
  TIPO_PROCESSO_LABEL,
  type BlocoFluxo,
  type Imobiliaria,
  type LocalServico,
  type PacoteItem,
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

// 4 órgãos em destaque (os mais usados no dia a dia); o resto entra
// agrupado em "Outros" pra não poluir a tela. Múltipla escolha: dá
// pra marcar vários órgãos e ir somando itens de cada um no mesmo
// orçamento.
type OrgaoOrcamento = "CRI" | "RCPN" | "NOTAS" | "SEFAZ" | "OUTROS";

const ORGAOS_ORCAMENTO: { chave: OrgaoOrcamento; nome: string; locais: LocalServico[] }[] = [
  { chave: "CRI", nome: "Registro de Imóveis", locais: ["CRI"] },
  { chave: "RCPN", nome: "Registro Civil", locais: ["RCPN"] },
  { chave: "NOTAS", nome: "Tabelionato de Notas", locais: ["NOTAS"] },
  { chave: "SEFAZ", nome: "SEFAZ", locais: ["SEFAZ"] },
  { chave: "OUTROS", nome: "Outros", locais: ["SEDUR", "TJ", "TRT", "TRF", "RF", "SOMA"] },
];

// Categoria (nm_categoria) com poucos itens vira uma única opção
// "Outros serviços" em vez de um botão só pra ela — limpa a tela sem
// esconder nenhum serviço, só agrupa visualmente.
const CATEGORIA_MIN_ITENS = 3;
const OUTROS_SERVICOS = "__outros_servicos__";

export function OrcamentoForm({
  imobiliarias,
  servicos,
  custas,
  cidades,
  blocosAtivos,
  blocosAplicaveis,
  ordemBlocos,
  pacoteItens,
}: {
  imobiliarias: Imobiliaria[];
  servicos: ServicoComPrecos[];
  custas: TabelaCustaItem[];
  cidades: string[];
  blocosAtivos: Partial<Record<BlocoFluxo, boolean>>;
  blocosAplicaveis: Partial<Record<BlocoFluxo, TipoAplicavelFluxo>>;
  ordemBlocos: BlocoFluxo[];
  pacoteItens: PacoteItem[];
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
  const [nmCidade, setNmCidade] = useState<string>(cidades[0] ?? "");
  const [dtValidade, setDtValidade] = useState("");
  const [dsInscricaoMunicipal, setDsInscricaoMunicipal] = useState("");

  // Opcionais — alimentam a calculadora/pacote de Compra e Venda lá
  // embaixo (ITIV, Lavratura, Registro), não travam nada em branco.
  const [valorTransacao, setValorTransacao] = useState("");
  const [valorVenal, setValorVenal] = useState("");
  const baseCalculo = Math.max(Number(valorTransacao) || 0, Number(valorVenal) || 0);

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

  // Categorias com poucos itens (< CATEGORIA_MIN_ITENS) somem da lista
  // de botões e ficam disponíveis juntas em "Outros serviços" — limpa
  // a tela sem esconder nenhum serviço do catálogo.
  const { categoriasPrincipais, categoriasSecundarias } = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const s of servicosDosOrgaos) {
      if (!s.nm_categoria) continue;
      contagem.set(s.nm_categoria, (contagem.get(s.nm_categoria) ?? 0) + 1);
    }
    const principais: string[] = [];
    const secundarias: string[] = [];
    for (const [categoria, qtd] of contagem) {
      (qtd >= CATEGORIA_MIN_ITENS ? principais : secundarias).push(categoria);
    }
    const ordenar = (a: string, b: string) => a.localeCompare(b, "pt-BR");
    return {
      categoriasPrincipais: principais.sort(ordenar),
      categoriasSecundarias: secundarias.sort(ordenar),
    };
  }, [servicosDosOrgaos]);

  const categoriasDisponiveis = useMemo(
    () => [...categoriasPrincipais, ...(categoriasSecundarias.length > 0 ? [OUTROS_SERVICOS] : [])],
    [categoriasPrincipais, categoriasSecundarias]
  );

  // Lista final que alimenta o combobox de "Adicionar" — Contrato usa
  // servicosDosOrgaos direto (categoria única, não precisa escolher).
  const servicosParaAdicionar = useMemo(() => {
    if (tpProcesso === "contrato") return servicosDosOrgaos;
    if (categoriasSelecionadas.size === 0) return [];
    const outrosMarcado = categoriasSelecionadas.has(OUTROS_SERVICOS);
    return servicosDosOrgaos.filter((s) => {
      if (!s.nm_categoria) return false;
      if (categoriasSelecionadas.has(s.nm_categoria)) return true;
      return outrosMarcado && categoriasSecundarias.includes(s.nm_categoria);
    });
  }, [servicosDosOrgaos, tpProcesso, categoriasSelecionadas, categoriasSecundarias]);

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

    // Pacote (Configurações > Pacotes) — boletos vinculados a esse
    // serviço entram junto automaticamente, sem precisar buscar o
    // código manualmente. Opcional entra igual, só marcado na
    // descrição pra remover se não servir nesse orçamento.
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

  // ITIV — alíquota fixa de 3% sobre o maior entre valor da transação
  // e valor venal (Lei Municipal), igual o processo manual já faz na
  // mão. Pacote junta ITIV + Lavratura (NOTAS) + Registro (RI) +
  // Prenotação em dobro (RI) + Certidão de Ônus (proxy — RI ainda não
  // tem um código exato "Certidão de Ônus Reais" cadastrado) num clique.
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

  function atualizarSecao(cd_item: string, tp_secao: "inicial" | "final") {
    setItens((atual) =>
      atual.map((item) => (item.cd_item === cd_item ? { ...item, tp_secao } : item))
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
        ds_inscricao_municipal: dsInscricaoMunicipal,
        vl_transacao: valorTransacao ? Number(valorTransacao) : null,
        vl_venal: valorVenal ? Number(valorVenal) : null,
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
                <Label htmlFor="nm_comprador_convidado">Nome do cliente</Label>
                <Input
                  id="nm_comprador_convidado"
                  value={nmCompradorConvidado}
                  onChange={(e) => setNmCompradorConvidado(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ds_telefone_comprador_convidado">Telefone do cliente</Label>
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
                  {cidades.map((cidade) => (
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
                  Usados na calculadora de boleto por faixa (ITV) lá embaixo — o sistema usa
                  sempre o maior dos dois.
                </p>
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
                    {categoria === OUTROS_SERVICOS ? "Outros serviços" : categoria}
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
                Custas oficiais de cartório/tribunal (TJBA) — busque pelo código do ato, ou use as
                ferramentas abaixo pra Compra e Venda (ITIV, Lavratura, Registro).
              </p>

              {baseCalculo > 0 && (
                <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
                  <p className="text-sm font-medium text-foreground">Compra e Venda</p>
                  <p className="text-xs text-muted-foreground">
                    Base de cálculo: <strong>{formatarMoeda(baseCalculo)}</strong> (maior valor
                    entre transação e venal, informados em Informações Básicas)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={adicionarItiv}>
                      Adicionar ITIV (3%)
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={adicionarPacoteCompraVenda}
                    >
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
                        <th className="px-3 py-2 font-medium">Seção</th>
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
