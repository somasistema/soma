-- ================================================================
-- SOMA — Migration 031
-- Inscrição Municipal só pode ter número, até 15 dígitos. Sanitiza o
-- que já existe (tira tudo que não é dígito, corta em 15) antes de
-- apertar a coluna, pra não quebrar em cima de dado antigo fora do
-- padrão.
-- ================================================================

UPDATE soma.orcamentos
SET ds_inscricao_municipal = LEFT(REGEXP_REPLACE(ds_inscricao_municipal, '\D', '', 'g'), 15)
WHERE ds_inscricao_municipal IS NOT NULL;

ALTER TABLE soma.orcamentos
  ALTER COLUMN ds_inscricao_municipal TYPE VARCHAR(15),
  ADD CONSTRAINT chk_orcamentos_inscricao_municipal_numerica
    CHECK (ds_inscricao_municipal IS NULL OR ds_inscricao_municipal ~ '^[0-9]{1,15}$');
