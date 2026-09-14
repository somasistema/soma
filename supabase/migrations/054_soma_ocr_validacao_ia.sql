-- ================================================================
-- SOMA — Migration 054
-- Conferência do OCR local por IA (Claude, opcional — só roda com
-- ANTHROPIC_API_KEY configurada; ver src/lib/ocr/validar-ia.ts). Não
-- substitui o Tesseract/mupdf, só confere o que já foi lido e sugere
-- correção quando discorda.
-- ================================================================

ALTER TABLE soma.documento_ocr
  ADD COLUMN sn_tipo_confere_ia BOOLEAN,
  ADD COLUMN tp_documento_sugerido_ia VARCHAR(30),
  ADD COLUMN ts_validacao_ia TIMESTAMPTZ;

ALTER TABLE soma.documento_ocr_campos
  ADD COLUMN sn_confere_ia BOOLEAN,
  ADD COLUMN ds_valor_sugerido_ia TEXT,
  ADD COLUMN nr_confianca_ia NUMERIC(5, 2);
