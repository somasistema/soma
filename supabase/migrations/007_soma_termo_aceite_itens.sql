-- ================================================================
-- SOMA — Migration 007
-- Fluxo de aceite passa a exigir: (1) ciência do Termo de Ciência e
-- Aceite dos Serviços de Despachante, e (2) seleção item a item do
-- orçamento — o comprador pode desmarcar itens antes de aceitar, e
-- o total exibido/gravado reflete só os itens selecionados.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. COLUNAS NOVAS
-- ----------------------------------------------------------------

-- Cada item nasce selecionado (comportamento atual — aceite total).
ALTER TABLE soma.orcamento_servicos
  ADD COLUMN IF NOT EXISTS sn_selecionado BOOLEAN NOT NULL DEFAULT true;

-- Momento em que o comprador confirmou ciência do Termo de Despachante,
-- e o total efetivamente aceito (pode ser menor que vl_total_geral se
-- algum item foi desmarcado no aceite).
ALTER TABLE soma.orcamentos
  ADD COLUMN IF NOT EXISTS ts_aceite_termo TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS vl_total_aceito NUMERIC(15,2);

-- ----------------------------------------------------------------
-- 2. LEITURA — inclui cd_orcamento_servico (pra controlar checkbox no
-- client) e sn_selecionado.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_obter_orcamento_por_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_resultado JSONB;
BEGIN
  SELECT jsonb_build_object(
    'cd_orcamento', o.cd_orcamento,
    'nm_cidade', o.nm_cidade,
    'dt_validade', o.dt_validade,
    'tp_status', o.tp_status,
    'vl_total_honorarios', o.vl_total_honorarios,
    'vl_total_custas', o.vl_total_custas,
    'vl_total_geral', o.vl_total_geral,
    'vl_total_aceito', o.vl_total_aceito,
    'ds_pdf_url', o.ds_pdf_url,
    'processo', jsonb_build_object(
      'ds_numero_processo', p.ds_numero_processo,
      'tp_processo', p.tp_processo,
      'nm_comprador_convidado', p.nm_comprador_convidado
    ),
    'itens', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'cd_orcamento_servico', os.cd_orcamento_servico,
          'ds_descricao', os.ds_descricao,
          'tp_servico', os.tp_servico,
          'vl_unitario', os.vl_unitario,
          'nr_quantidade', os.nr_quantidade,
          'vl_subtotal', os.vl_subtotal,
          'sn_selecionado', os.sn_selecionado
        ) ORDER BY os.ds_descricao)
       FROM soma.orcamento_servicos os
       WHERE os.cd_orcamento = o.cd_orcamento),
      '[]'::jsonb
    )
  )
  INTO v_resultado
  FROM soma.orcamentos o
  JOIN soma.processos p ON p.cd_processo = o.cd_processo
  WHERE o.cd_token_aceite = p_token;

  RETURN v_resultado; -- NULL se não achou linha nenhuma
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_obter_orcamento_por_token TO anon, authenticated;

-- ----------------------------------------------------------------
-- 3. ACEITE — agora recebe quais itens ficaram selecionados e exige
-- confirmação explícita do Termo de Ciência e Aceite. Grava
-- ts_aceite_termo e recalcula vl_total_aceito a partir dos itens
-- marcados (os desmarcados permanecem no orçamento para histórico,
-- só não entram no total aceito).
--
-- A assinatura mudou (ganhou 2 parâmetros) em relação à versão da
-- migration 006, então CREATE OR REPLACE não substitui a antiga — ele
-- cria uma segunda função sobrecarregada com o mesmo nome. Por isso
-- derrubamos a versão antiga explicitamente antes de criar a nova.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS soma.fn_aceitar_orcamento_por_token(UUID);

CREATE OR REPLACE FUNCTION soma.fn_aceitar_orcamento_por_token(
  p_token UUID,
  p_itens_selecionados UUID[],
  p_termo_aceito BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_orcamento UUID;
  v_tp_status soma.type_orcamento_status;
  v_dt_validade DATE;
  v_total_aceito NUMERIC(15,2);
BEGIN
  IF p_termo_aceito IS NOT TRUE THEN
    RAISE EXCEPTION 'É necessário confirmar a ciência do Termo de Ciência e Aceite dos Serviços de Despachante.';
  END IF;

  IF p_itens_selecionados IS NULL OR array_length(p_itens_selecionados, 1) IS NULL THEN
    RAISE EXCEPTION 'Selecione ao menos um item do orçamento para aceitar.';
  END IF;

  SELECT cd_orcamento, tp_status, dt_validade
  INTO v_cd_orcamento, v_tp_status, v_dt_validade
  FROM soma.orcamentos
  WHERE cd_token_aceite = p_token;

  IF v_cd_orcamento IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  IF v_tp_status <> 'pendente' THEN
    RAISE EXCEPTION 'Este orçamento já foi processado.';
  END IF;

  IF v_dt_validade < CURRENT_DATE THEN
    RAISE EXCEPTION 'Este orçamento está vencido.';
  END IF;

  -- Garante que os ids recebidos pertencem mesmo a este orçamento.
  IF EXISTS (
    SELECT 1 FROM unnest(p_itens_selecionados) AS sel(cd_orcamento_servico)
    WHERE NOT EXISTS (
      SELECT 1 FROM soma.orcamento_servicos os
      WHERE os.cd_orcamento_servico = sel.cd_orcamento_servico
        AND os.cd_orcamento = v_cd_orcamento
    )
  ) THEN
    RAISE EXCEPTION 'Seleção de itens inválida para este orçamento.';
  END IF;

  UPDATE soma.orcamento_servicos
  SET sn_selecionado = (cd_orcamento_servico = ANY(p_itens_selecionados))
  WHERE cd_orcamento = v_cd_orcamento;

  SELECT COALESCE(SUM(vl_subtotal), 0)
  INTO v_total_aceito
  FROM soma.orcamento_servicos
  WHERE cd_orcamento = v_cd_orcamento AND sn_selecionado;

  UPDATE soma.orcamentos
  SET tp_status = 'aceito',
      ts_aceite = now(),
      ts_aceite_termo = now(),
      vl_total_aceito = v_total_aceito
  WHERE cd_orcamento = v_cd_orcamento;

  RETURN jsonb_build_object('sucesso', true, 'vl_total_aceito', v_total_aceito);
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_aceitar_orcamento_por_token(UUID, UUID[], BOOLEAN) TO anon, authenticated;
