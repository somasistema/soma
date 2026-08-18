import type { OrcamentoAceiteItem } from "@/types/database";

// Enquanto a sprint 03 (emissão automática de DAJ) não sai, o
// despachante manda a guia de recolhimento das custas direto pro
// cliente, fora do sistema — então o valor cobrado por aqui (Pix/
// cartão) e mostrado pro cliente como "a pagar" é só a soma dos
// honorários dos itens selecionados no aceite, nunca custas.
export function vlHonorariosAceitos(itens: OrcamentoAceiteItem[]): number {
  return itens
    .filter((item) => item.tp_servico === "honorario" && item.sn_selecionado)
    .reduce((soma, item) => soma + item.vl_subtotal, 0);
}
