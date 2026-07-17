-- ================================================================
-- SOMA — Migration 002
-- Fecha o RLS nas tabelas que ficaram sem policy na migration 001
-- ================================================================

-- ----------------------------------------------------------------
-- 0. HABILITAR RLS NAS TABELAS PENDENTES
-- ----------------------------------------------------------------
ALTER TABLE soma.imobiliarias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.servicos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.orcamento_servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.pagamentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.documentos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.pendencias        ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.andamentos        ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 1. FUNÇÃO HELPER: usuário pertence ao processo?
-- Reaproveitada por várias policies abaixo — evita repetir o EXISTS
-- em cada tabela e centraliza a regra "quem enxerga um processo".
-- SECURITY DEFINER pelo mesmo motivo de soma.fn_auth_role(): evita
-- reavaliação de RLS dentro da própria função.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_pode_ver_processo(p_cd_processo UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM soma.processos p
    WHERE p.cd_processo = p_cd_processo
    AND (
      soma.fn_auth_role() IN ('master', 'juridico')
      OR p.cd_comprador = auth.uid()
      OR p.cd_vendedor = auth.uid()
      OR p.cd_corretor = auth.uid()
      OR p.cd_despachante = auth.uid()
      OR p.cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
    )
  );
$$;

-- ----------------------------------------------------------------
-- 2. IMOBILIARIAS
-- Master/Jurídico veem todas; demais só a própria imobiliária vinculada
-- ----------------------------------------------------------------
CREATE POLICY "imobiliarias_select" ON soma.imobiliarias FOR SELECT
  USING (
    soma.fn_auth_role() IN ('master', 'juridico')
    OR cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
  );

CREATE POLICY "imobiliarias_insert" ON soma.imobiliarias FOR INSERT
  WITH CHECK (soma.fn_auth_role() IN ('master', 'juridico'));

CREATE POLICY "imobiliarias_update" ON soma.imobiliarias FOR UPDATE
  USING (soma.fn_auth_role() IN ('master', 'juridico'));

-- ----------------------------------------------------------------
-- 3. SERVICOS
-- Tabela de preços — leitura liberada pra todo autenticado (precisa
-- pra montar orçamento), escrita só pelo Master.
-- ----------------------------------------------------------------
CREATE POLICY "servicos_select" ON soma.servicos FOR SELECT
  USING (true);

CREATE POLICY "servicos_insert" ON soma.servicos FOR INSERT
  WITH CHECK (soma.fn_auth_role() = 'master');

CREATE POLICY "servicos_update" ON soma.servicos FOR UPDATE
  USING (soma.fn_auth_role() = 'master');

CREATE POLICY "servicos_delete" ON soma.servicos FOR DELETE
  USING (soma.fn_auth_role() = 'master');

-- ----------------------------------------------------------------
-- 4. ORCAMENTO_SERVICOS
-- Leitura/escrita via orcamento -> processo
-- ----------------------------------------------------------------
CREATE POLICY "orcamento_servicos_select" ON soma.orcamento_servicos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.orcamentos o
      WHERE o.cd_orcamento = orcamento_servicos.cd_orcamento
      AND soma.fn_pode_ver_processo(o.cd_processo)
    )
  );

CREATE POLICY "orcamento_servicos_insert" ON soma.orcamento_servicos FOR INSERT
  WITH CHECK (soma.fn_auth_role() IN ('master', 'juridico'));

-- ----------------------------------------------------------------
-- 5. PAGAMENTOS
-- Dado financeiro sensível — mesmo padrão de acesso via processo
-- ----------------------------------------------------------------
CREATE POLICY "pagamentos_select" ON soma.pagamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.orcamentos o
      WHERE o.cd_orcamento = pagamentos.cd_orcamento
      AND soma.fn_pode_ver_processo(o.cd_processo)
    )
  );

-- Inserção normalmente vem do backend/webhook com service_role (que
-- ignora RLS), então isso aqui é só uma trava de segurança contra
-- inserção direta do client. Deixando fechado por padrão:
CREATE POLICY "pagamentos_insert" ON soma.pagamentos FOR INSERT
  WITH CHECK (soma.fn_auth_role() IN ('master', 'juridico'));

-- Só a Imobiliária (ou Master) libera o pagamento
CREATE POLICY "pagamentos_update" ON soma.pagamentos FOR UPDATE
  USING (
    soma.fn_auth_role() IN ('master', 'imobiliaria')
    AND EXISTS (
      SELECT 1 FROM soma.orcamentos o
      WHERE o.cd_orcamento = pagamentos.cd_orcamento
      AND soma.fn_pode_ver_processo(o.cd_processo)
    )
  );

-- ----------------------------------------------------------------
-- 6. DOCUMENTOS
-- Quem enviou, Master/Jurídico, ou Despachante do processo
-- ----------------------------------------------------------------
CREATE POLICY "documentos_select" ON soma.documentos FOR SELECT
  USING (
    cd_enviado_por = auth.uid()
    OR soma.fn_auth_role() IN ('master', 'juridico')
    OR EXISTS (
      SELECT 1 FROM soma.processos p
      WHERE p.cd_processo = documentos.cd_processo
      AND p.cd_despachante = auth.uid()
    )
  );

CREATE POLICY "documentos_insert" ON soma.documentos FOR INSERT
  WITH CHECK (soma.fn_pode_ver_processo(cd_processo));

-- Só quem valida documento é Master/Jurídico/Despachante do processo
CREATE POLICY "documentos_update" ON soma.documentos FOR UPDATE
  USING (
    soma.fn_auth_role() IN ('master', 'juridico')
    OR EXISTS (
      SELECT 1 FROM soma.processos p
      WHERE p.cd_processo = documentos.cd_processo
      AND p.cd_despachante = auth.uid()
    )
  );

-- ----------------------------------------------------------------
-- 7. PENDENCIAS
-- Responsável, Master/Jurídico, ou qualquer envolvido no processo
-- ----------------------------------------------------------------
CREATE POLICY "pendencias_select" ON soma.pendencias FOR SELECT
  USING (
    cd_responsavel = auth.uid()
    OR soma.fn_pode_ver_processo(cd_processo)
  );

CREATE POLICY "pendencias_insert" ON soma.pendencias FOR INSERT
  WITH CHECK (soma.fn_auth_role() IN ('master', 'juridico', 'despachante'));

CREATE POLICY "pendencias_update" ON soma.pendencias FOR UPDATE
  USING (
    cd_responsavel = auth.uid()
    OR soma.fn_auth_role() IN ('master', 'juridico')
  );

-- ----------------------------------------------------------------
-- 8. ANDAMENTOS
-- Trilha de auditoria do Despachante — leitura por quem enxerga o processo,
-- escrita só pelo Despachante responsável (ou Master)
-- ----------------------------------------------------------------
CREATE POLICY "andamentos_select" ON soma.andamentos FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));

CREATE POLICY "andamentos_insert" ON soma.andamentos FOR INSERT
  WITH CHECK (
    cd_despachante = auth.uid()
    OR soma.fn_auth_role() = 'master'
  );

-- ================================================================
-- Nota: essas policies cobrem o fluxo padrão da Fase 1. Ajuste fino
-- por tela (ex: Comprador só lê andamento, nunca escreve) deve ser
-- validado durante o desenvolvimento do frontend, já que RLS erra
-- silenciosamente (não dá erro), então teste é obrigatório.
-- ================================================================
