-- ================================================================
-- SOMA — Migration 018
-- Antes, "Órgão" e "Tipo de Serviço" só se aplicarem ao ramo
-- Despachante estava fixo no código. Agora é configurável direto na
-- tela Configurações > Fluxo: cada bloco tem um tp_aplicavel
-- ('ambos', 'despachante' ou 'contrato'), e /orcamentos/novo lê isso
-- do banco pra decidir se mostra o bloco. Mantém o comportamento
-- atual como valor inicial (órgão/tipo_servico só despachante).
-- ================================================================

ALTER TABLE soma.fluxo_blocos
  ADD COLUMN tp_aplicavel VARCHAR(12) NOT NULL DEFAULT 'ambos'
    CHECK (tp_aplicavel IN ('ambos', 'despachante', 'contrato'));

UPDATE soma.fluxo_blocos
SET tp_aplicavel = 'despachante'
WHERE cd_bloco IN ('orgao', 'tipo_servico');
