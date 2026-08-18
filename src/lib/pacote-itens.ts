import type { ItemOrcamentoInput } from "@/app/(dashboard)/orcamentos/novo/actions";
import type { PacoteItem, Servico, TabelaCustaItem } from "@/types/database";

function encontrarFaixa(custas: TabelaCustaItem[], tpTabela: string, nmSecao: string, base: number) {
  return custas.find(
    (c) =>
      c.tp_tabela === tpTabela &&
      c.nm_secao === nmSecao &&
      (c.vl_faixa_min == null || base >= c.vl_faixa_min) &&
      (c.vl_faixa_max == null || base <= c.vl_faixa_max)
  );
}

// Resolve os itens configurados em Configurações > Pacotes pra um
// serviço (boleto fixo, faixa variável por valor, ou ITIV 3%) —
// usado ao adicionar um serviço no orçamento (novo e complementar).
// "ambas" duplica o item (Custos Iniciais + Custos Finais).
export function resolverItensDoPacote(
  pacoteItens: PacoteItem[],
  servico: Pick<Servico, "cd_servico">,
  custas: TabelaCustaItem[],
  baseCalculo: number
): ItemOrcamentoInput[] {
  const vinculos = pacoteItens.filter((p) => p.cd_servico === servico.cd_servico);
  const itens: ItemOrcamentoInput[] = [];

  for (const vinculo of vinculos) {
    let descricao: string;
    let valor: number;
    let snDescontoElegivel = false;

    if (vinculo.tp_origem === "itiv") {
      if (baseCalculo <= 0) continue;
      valor = Math.round(baseCalculo * 0.03 * 100) / 100;
      descricao = "ITIV — 3% sobre a base de cálculo (maior valor entre transação e venal)";
    } else if (vinculo.tp_origem === "faixa") {
      if (baseCalculo <= 0 || !vinculo.tp_tabela_faixa || !vinculo.nm_secao_faixa) continue;
      const custa = encontrarFaixa(custas, vinculo.tp_tabela_faixa, vinculo.nm_secao_faixa, baseCalculo);
      if (!custa?.vl_pagar) continue;
      valor = custa.vl_pagar;
      descricao = custa.ds_ato;
      snDescontoElegivel = custa.sn_desconto_primeiro_imovel;
    } else {
      const custa = custas.find((c) => c.cd_custa === vinculo.cd_custa);
      if (!custa) continue;
      valor = custa.vl_pagar ?? 0;
      descricao = custa.cd_ato ? `[${custa.cd_ato}] ${custa.ds_ato}` : custa.ds_ato;
      snDescontoElegivel = custa.sn_desconto_primeiro_imovel;
    }

    if (vinculo.sn_opcional) descricao = `${descricao} (opcional)`;

    const secoes: ItemOrcamentoInput["tp_secao"][] =
      vinculo.tp_secao_padrao === "ambas" ? ["inicial", "final"] : [vinculo.tp_secao_padrao];

    for (const secao of secoes) {
      itens.push({
        cd_servico: "",
        ds_descricao: descricao,
        tp_servico: "custa",
        tp_secao: secao,
        vl_unitario: valor,
        nr_quantidade: 1,
        snDescontoElegivel,
      });
    }
  }

  return itens;
}
