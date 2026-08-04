-- ================================================================
-- SOMA — Migration 024
-- Novo bloco no Fluxo: "Dados do Imóvel (ITIV)" — separa Inscrição
-- Municipal, Valor da Transação e Valor Venal de dentro de
-- "Informações Básicas" pra um card próprio, configurável/ativável
-- à parte (posição entre Informações Básicas e Órgão).
--
-- A migration 017 dizia que os 6 blocos originais eram fixos, sem
-- INSERT pela aplicação — isso vale pros blocos daquele momento; a
-- tela de novo orçamento evoluiu e ganhou um card novo, então este
-- é o primeiro bloco adicionado depois do desenho inicial.
-- ================================================================

INSERT INTO soma.fluxo_blocos (cd_bloco, nm_bloco, posicao_x, posicao_y, tp_aplicavel)
VALUES ('dados_imovel', 'Dados do Imóvel (ITIV)', 350, 220, 'ambos')
ON CONFLICT (cd_bloco) DO NOTHING;
