// TEMPORÁRIO — estamos usando credenciais de PRODUÇÃO (dinheiro real) do
// Mercado Pago, mas ainda em fase de demonstração pro pessoal da SOMA.
// Enquanto isso, todo pagamento (Pix ou cartão) sai fixo em R$ 1, não
// importa o valor real do orçamento — tanto o valor cobrado de fato
// quanto o que aparece no formulário de pagamento usam essa constante.
//
// Pra voltar a cobrar o valor real do orçamento, apague este arquivo e
// as duas importações dele (em pagamento-actions.ts e page.tsx),
// voltando a usar `vlHonorariosAceitos(orcamento.itens)` (de
// "@/lib/orcamento-totais") diretamente nos dois lugares — NÃO usar
// vl_total_geral/vl_total_aceito, que somam honorários + custas: até a
// sprint 03 (emissão automática de DAJ), o despachante manda a guia
// das custas separado, fora do sistema, então só honorários são
// cobrados por aqui.
export const VALOR_FIXO_DEMONSTRACAO = 1;
