-- ================================================================
-- SOMA — Migration 016
-- Os 8 itens de Contrato Imobiliário (migration 014) entraram como
-- valor variável, sem preço definido ainda. Definido: todos custam
-- R$ 350,00, fixo, nas 3 cidades — não muda mais por faixa/negociação
-- caso a caso como os outros serviços de valor variável.
-- ================================================================

UPDATE soma.servicos
SET sn_valor_variavel = false
WHERE tp_local = 'CONTRATO';

-- Upsert em vez de delete+insert: idempotente mesmo se algum desses
-- serviços já tiver preço cadastrado manualmente (ex: via tela de
-- Editar em /servicos) antes desta migration rodar.
INSERT INTO soma.servico_precos (cd_servico, nm_cidade, vl_valor)
SELECT s.cd_servico, cidade.nm_cidade, 350.00
FROM soma.servicos s
CROSS JOIN (VALUES ('Salvador'), ('Lauro de Freitas'), ('Camaçari')) AS cidade(nm_cidade)
WHERE s.tp_local = 'CONTRATO'
ON CONFLICT (cd_servico, nm_cidade) DO UPDATE SET vl_valor = EXCLUDED.vl_valor;
