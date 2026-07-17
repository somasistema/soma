-- ================================================================
-- SOMA — Migration 003
-- O Jurídico monta o orçamento antes do Comprador ter conta no
-- sistema (ele só vira usuário de fato ao aceitar o link). Esses
-- campos guardam os dados de contato até esse momento; cd_comprador
-- continua nulo até lá e é preenchido quando a conta é criada.
-- ================================================================

ALTER TABLE soma.processos
  ADD COLUMN nm_comprador_convidado VARCHAR(255),
  ADD COLUMN ds_telefone_comprador_convidado VARCHAR(20);

COMMENT ON COLUMN soma.processos.nm_comprador_convidado IS
  'Nome do comprador antes de ele ter conta — usado até cd_comprador ser preenchido';

COMMENT ON COLUMN soma.processos.ds_telefone_comprador_convidado IS
  'WhatsApp do comprador — usado pra enviar o link de aceite antes de haver conta';
