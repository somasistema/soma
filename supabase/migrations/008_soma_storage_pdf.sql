-- ================================================================
-- SOMA — Migration 008
-- Bucket de Storage para os PDFs profissionais de orçamento. É
-- público (leitura sem autenticação) porque o link do PDF pode ser
-- compartilhado com o comprador via WhatsApp antes de qualquer login
-- — mesmo raciocínio do link de aceite. Escrita fica restrita a
-- Master/Jurídico, que são os únicos perfis que criam orçamento.
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('orcamentos-pdf', 'orcamentos-pdf', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "orcamentos_pdf_select_publico" ON storage.objects FOR SELECT
  USING (bucket_id = 'orcamentos-pdf');

CREATE POLICY "orcamentos_pdf_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'orcamentos-pdf' AND soma.fn_auth_role() IN ('master', 'juridico'));

CREATE POLICY "orcamentos_pdf_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'orcamentos-pdf' AND soma.fn_auth_role() IN ('master', 'juridico'));

CREATE POLICY "orcamentos_pdf_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'orcamentos-pdf' AND soma.fn_auth_role() IN ('master', 'juridico'));
