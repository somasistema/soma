-- ================================================================
-- SOMA — Migration 036
-- Despachante não tem cd_imobiliaria vinculado (é staff interno, não
-- pertence a uma imobiliária específica) mas precisa criar orçamento
-- pra clientes de qualquer imobiliária — igual jurídico. A policy de
-- SELECT em soma.imobiliarias só liberava master/jurídico ou "a
-- própria imobiliária do usuário", então despachante via o combo
-- "Imobiliária" sempre vazio e não conseguia salvar o orçamento
-- (cd_imobiliaria chegava "" na RPC, que espera UUID).
-- ================================================================

DROP POLICY IF EXISTS "imobiliarias_select" ON soma.imobiliarias;
CREATE POLICY "imobiliarias_select" ON soma.imobiliarias FOR SELECT
  USING (
    soma.fn_auth_role() IN ('master', 'juridico', 'despachante')
    OR cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
  );
