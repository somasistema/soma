-- ================================================================
-- SOMA — Migration 006
-- Página pública de aceite (/aceite/[token]) é acessada sem sessão
-- (o comprador ainda não tem conta). As duas funções abaixo rodam
-- como SECURITY DEFINER pra ignorar RLS e são liberadas pro role
-- `anon`, mas cada uma resolve o orçamento pelo cd_token_aceite —
-- é esse token (UUID aleatório, não sequencial) que faz o papel de
-- autorização aqui, não uma policy de RLS baseada em auth.uid().
-- ================================================================

-- ----------------------------------------------------------------
-- 1. LEITURA — devolve orçamento + processo + itens num único JSON.
-- Retorna NULL se o token não existir (a página trata como notFound()).
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
    'ds_pdf_url', o.ds_pdf_url,
    'processo', jsonb_build_object(
      'ds_numero_processo', p.ds_numero_processo,
      'tp_processo', p.tp_processo,
      'nm_comprador_convidado', p.nm_comprador_convidado
    ),
    'itens', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
          'ds_descricao', os.ds_descricao,
          'tp_servico', os.tp_servico,
          'vl_unitario', os.vl_unitario,
          'nr_quantidade', os.nr_quantidade,
          'vl_subtotal', os.vl_subtotal
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
-- 2. ACEITE — só muda status se ainda estiver 'pendente' e dentro
-- da validade. Levanta exceção nos demais casos; a action no
-- Next.js converte isso em { sucesso: false, erro }.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_aceitar_orcamento_por_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_orcamento UUID;
  v_tp_status soma.type_orcamento_status;
  v_dt_validade DATE;
BEGIN
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

  UPDATE soma.orcamentos
  SET tp_status = 'aceito', ts_aceite = now()
  WHERE cd_orcamento = v_cd_orcamento;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_aceitar_orcamento_por_token TO anon, authenticated;
