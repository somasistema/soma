-- ================================================================
-- SOMA — Migration 066
-- Vários signatários por papel no contrato: empresa vendedora tem 2
-- representantes e sócios anuentes, casal comprador tem 2 pessoas,
-- etc. Antes a tabela só aceitava 1 linha por (contrato, papel).
-- Cada pessoa continua sendo uma linha; o contrato só fecha quando
-- todas assinam (fn_concluir_assinatura_contrato já conta as pendentes).
-- ================================================================

ALTER TABLE soma.contrato_signatarios
  DROP CONSTRAINT IF EXISTS contrato_signatarios_cd_contrato_tp_papel_key;

-- Uma pessoa (e-mail) aparece uma vez por contrato.
CREATE UNIQUE INDEX IF NOT EXISTS uq_contrato_signatarios_email
  ON soma.contrato_signatarios (cd_contrato, lower(ds_email));
