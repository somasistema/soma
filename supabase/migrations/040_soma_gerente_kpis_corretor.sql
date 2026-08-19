-- ================================================================
-- SOMA — Migration 040
-- Fase 2: Perfil Gerente (visão executiva) + KPIs + atribuição de
-- Corretor no orçamento. Requer a migration 039 já aplicada (enum
-- 'gerente' precisa existir e estar "commitada" antes de usar aqui).
--
-- 1) Nova seção de menu "kpis" (dashboard executivo) — Master e
--    Gerente por padrão, resto desligado (Master ajusta depois em
--    Configurações > Perfil de acesso se quiser liberar pra outros).
-- 2) Gerente ganha a mesma visibilidade "enxerga tudo" que
--    master/jurídico já tinham em processos/orçamentos — sem isso o
--    dashboard de KPIs ficaria vazio (RLS cortaria pra linha zero).
-- 3) soma.processos ganha atribuição de Corretor na criação do
--    orçamento (cd_corretor já existia na tabela desde a fase 1, só
--    não tinha nenhum caminho no app pra preencher) — necessário pro
--    ranking por corretor ter dado pra mostrar.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Seção "kpis" no menu — seed pros perfis que já existiam antes
--    dessa migration, e Gerente pra todas as seções relevantes.
-- ----------------------------------------------------------------
INSERT INTO soma.perfil_acesso (tp_role, cd_secao, sn_ver, sn_criar, sn_editar, sn_excluir)
SELECT r.tp_role, 'kpis', (r.tp_role = 'master'), false, false, false
FROM (VALUES
  ('master'), ('juridico'), ('imobiliaria'), ('despachante'),
  ('corretor'), ('vendedor'), ('comprador'), ('outro_cliente')
) AS r(tp_role);

INSERT INTO soma.perfil_acesso (tp_role, cd_secao, sn_ver, sn_criar, sn_editar, sn_excluir)
SELECT 'gerente', s.cd_secao,
  s.cd_secao IN ('dashboard', 'orcamentos', 'processos', 'kpis'),
  false, false, false
FROM (VALUES
  ('dashboard'), ('orcamentos'), ('processos'), ('servicos'),
  ('boletos'), ('usuarios'), ('configuracoes'), ('kpis')
) AS s(cd_secao);

-- ----------------------------------------------------------------
-- 2) RLS — Gerente enxerga todos os processos/orçamentos (visão
--    executiva), igual master/jurídico já tinham.
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "processos_select" ON soma.processos;
CREATE POLICY "processos_select" ON soma.processos FOR SELECT
  USING (
    soma.fn_auth_role() IN ('master', 'juridico', 'gerente')
    OR cd_comprador = auth.uid()
    OR cd_vendedor = auth.uid()
    OR cd_corretor = auth.uid()
    OR cd_despachante = auth.uid()
    OR cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
  );

DROP POLICY IF EXISTS "orcamentos_select" ON soma.orcamentos;
CREATE POLICY "orcamentos_select" ON soma.orcamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.processos p
      WHERE p.cd_processo = orcamentos.cd_processo
      AND (
        soma.fn_auth_role() IN ('master', 'juridico', 'gerente')
        OR p.cd_comprador = auth.uid()
        OR p.cd_vendedor = auth.uid()
        OR p.cd_corretor = auth.uid()
        OR p.cd_despachante = auth.uid()
        OR p.cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
      )
    )
  );

DROP POLICY IF EXISTS "usuarios_select" ON soma.usuarios;
CREATE POLICY "usuarios_select" ON soma.usuarios FOR SELECT
  USING (cd_usuario = auth.uid() OR soma.fn_auth_role() IN ('master', 'gerente'));

DROP POLICY IF EXISTS "imobiliarias_select" ON soma.imobiliarias;
CREATE POLICY "imobiliarias_select" ON soma.imobiliarias FOR SELECT
  USING (
    soma.fn_auth_role() IN ('master', 'juridico', 'despachante', 'gerente')
    OR cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
  );

-- ----------------------------------------------------------------
-- 3) fn_criar_orcamento ganha p_cd_corretor (opcional) — quem cria o
--    orçamento (master/jurídico/despachante) passa a poder atribuir
--    qual corretor originou aquele negócio, pro ranking em /kpis.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento(
  p_tp_processo VARCHAR(12),
  p_cd_imobiliaria UUID,
  p_nm_comprador_convidado VARCHAR,
  p_ds_telefone_comprador_convidado VARCHAR,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB,
  p_ds_inscricao_municipal VARCHAR DEFAULT NULL,
  p_vl_transacao NUMERIC DEFAULT NULL,
  p_vl_venal NUMERIC DEFAULT NULL,
  p_sn_primeiro_imovel BOOLEAN DEFAULT false,
  p_cd_corretor UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
  v_cd_orcamento UUID;
  v_vl_total_honorarios NUMERIC(15,2);
  v_vl_total_custas NUMERIC(15,2);
BEGIN
  IF NOT soma.fn_tem_permissao('orcamentos', 'criar') THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão pra criar orçamentos.';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item de serviço.';
  END IF;

  PERFORM soma.fn_validar_itens_tipo_processo(p_tp_processo, p_itens);

  INSERT INTO soma.processos (tp_processo, cd_imobiliaria, nm_comprador_convidado, ds_telefone_comprador_convidado, cd_corretor)
  VALUES (p_tp_processo, p_cd_imobiliaria, p_nm_comprador_convidado, p_ds_telefone_comprador_convidado, p_cd_corretor)
  RETURNING cd_processo INTO v_cd_processo;

  SELECT
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'honorario'), 0),
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'custa'), 0)
  INTO v_vl_total_honorarios, v_vl_total_custas
  FROM jsonb_array_elements(p_itens) AS item;

  INSERT INTO soma.orcamentos (
    cd_processo, cd_criador, nm_cidade, dt_validade, vl_total_honorarios, vl_total_custas,
    ds_inscricao_municipal, vl_transacao, vl_venal, sn_primeiro_imovel
  )
  VALUES (
    v_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas,
    p_ds_inscricao_municipal, p_vl_transacao, p_vl_venal, p_sn_primeiro_imovel
  )
  RETURNING cd_orcamento INTO v_cd_orcamento;

  INSERT INTO soma.orcamento_servicos (cd_orcamento, cd_servico, ds_descricao, tp_servico, vl_unitario, nr_quantidade, tp_secao)
  SELECT
    v_cd_orcamento,
    NULLIF(item->>'cd_servico', '')::uuid,
    item->>'ds_descricao',
    (item->>'tp_servico')::soma.type_servico,
    (item->>'vl_unitario')::numeric,
    (item->>'nr_quantidade')::integer,
    COALESCE(NULLIF(item->>'tp_secao', ''), 'inicial')
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN v_cd_orcamento;
END;
$$;
