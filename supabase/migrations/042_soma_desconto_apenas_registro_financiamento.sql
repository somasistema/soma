-- ================================================================
-- SOMA — Migration 042
-- Mapeamento que ficou pendente na migration 038: a Milena confirmou
-- que o desconto de 50% (primeiro imóvel/financiamento) é exclusivo
-- pra compra por FINANCIAMENTO BANCÁRIO — não vale pra à vista nem
-- consórcio — e mesmo no financiamento só incide sobre a taxa de
-- REGISTRO calculada pelo valor do imóvel (venal ou compra e venda, o
-- maior). Taxas fixas (prenotação, certidão de ônus, averbações) não
-- entram.
--
-- A taxa de registro por valor é a tabela RI, seção "I - Atos com
-- Valor Econômico" (21 faixas por valor — mesma seção usada pelo
-- pacote de Registro no ITIV, ver src/lib/pacote-itens.ts). Fora essa
-- seção, tudo continua sem desconto (default false da migration 038).
-- ================================================================

UPDATE soma.tabela_custas
SET sn_desconto_primeiro_imovel = true
WHERE tp_tabela = 'RI' AND nm_secao = 'I - Atos com Valor Econômico';
