-- ================================================================
-- SOMA — Migration 029
-- Pedidos do cliente ao revisar a planilha completa "TAXAS E
-- EMOLUMENTOS" (todos os órgãos, não só CRI):
--
-- 1) Desativa os 38 serviços "por faixa" que duplicavam a própria
--    tabela de custas como se fossem serviços à parte — poluíam a
--    lista de seleção (CRI > Registro "Atos imobiliários (faixa)" e
--    NOTAS > Escritura "Atos com valor econômico (faixa)", 19 cada).
--    A faixa continua disponível via Pacotes (tipo "faixa") e pela
--    calculadora por valor — não precisa de um "serviço" à parte pra
--    cada intervalo de preço.
--
-- 2) RCPN tinha duas categorias fazendo a mesma coisa por causa de
--    inconsistência de nome ("Certidão" e "Certidões" — plural só em
--    2 serviços). Unifica em "Certidão".
-- ================================================================

-- 1) Desativa os serviços "por faixa" duplicados
UPDATE soma.servicos
SET sn_ativo = false
WHERE tp_local = 'CRI' AND nm_categoria = 'Registro' AND nm_servico LIKE 'Atos imobiliários (%';

UPDATE soma.servicos
SET sn_ativo = false
WHERE tp_local = 'NOTAS' AND nm_categoria = 'Escritura' AND nm_servico LIKE 'Atos com valor econômico (%';

-- 2) Unifica "Certidões" (RCPN) em "Certidão"
UPDATE soma.servicos
SET nm_categoria = 'Certidão'
WHERE tp_local = 'RCPN' AND nm_categoria = 'Certidões';
