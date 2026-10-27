-- ================================================================
-- SOMA — Migration 068
-- Convite da minuta é por PESSOA: duas pessoas podem dividir o mesmo
-- e-mail (casal, por exemplo) e cada uma recebe o próprio link. Antes
-- (067) o índice só aceitava um convite por e-mail na minuta.
-- ================================================================

DROP INDEX IF EXISTS soma.uq_minuta_convites_email;

CREATE UNIQUE INDEX IF NOT EXISTS uq_minuta_convites_pessoa
  ON soma.minuta_convites (cd_minuta, lower(ds_email), lower(nm_destinatario));
