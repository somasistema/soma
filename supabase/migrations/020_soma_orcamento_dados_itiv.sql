-- ================================================================
-- SOMA — Migration 020
-- Fecha as lacunas mapeadas do processo manual de Compra e Venda:
-- 1) Inscrição Municipal do imóvel + Valor da transação/Valor venal
--    agora persistem no orçamento (antes só existiam na tela, eram
--    descartados ao salvar).
-- 2) Cada item do orçamento ganha uma seção (inicial/final), pra dar
--    pra separar Custos Iniciais x Custos Finais no PDF/tela, igual
--    o processo manual sempre teve. Default 'inicial' — itens
--    antigos (antes desta migration) também caem em 'inicial'.
-- ================================================================

ALTER TABLE soma.orcamentos
  ADD COLUMN ds_inscricao_municipal VARCHAR(50),
  ADD COLUMN vl_transacao NUMERIC(15,2),
  ADD COLUMN vl_venal NUMERIC(15,2);

ALTER TABLE soma.orcamento_servicos
  ADD COLUMN tp_secao VARCHAR(10) NOT NULL DEFAULT 'inicial'
    CHECK (tp_secao IN ('inicial', 'final'));

-- ----------------------------------------------------------------
-- fn_criar_orcamento — 3 parâmetros novos no fim (com default, então
-- CREATE OR REPLACE substitui a função existente sem precisar DROP).
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
  p_vl_venal NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
  v_cd_orcamento UUID;
  v_vl_total_honorarios NUMERIC(15,2);
  v_vl_total_custas NUMERIC(15,2);
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Apenas Master ou Jurídico podem criar orçamentos.';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item de serviço.';
  END IF;

  PERFORM soma.fn_validar_itens_tipo_processo(p_tp_processo, p_itens);

  INSERT INTO soma.processos (tp_processo, cd_imobiliaria, nm_comprador_convidado, ds_telefone_comprador_convidado)
  VALUES (p_tp_processo, p_cd_imobiliaria, p_nm_comprador_convidado, p_ds_telefone_comprador_convidado)
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
    ds_inscricao_municipal, vl_transacao, vl_venal
  )
  VALUES (
    v_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas,
    p_ds_inscricao_municipal, p_vl_transacao, p_vl_venal
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

GRANT EXECUTE ON FUNCTION soma.fn_criar_orcamento(VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, DATE, JSONB, VARCHAR, NUMERIC, NUMERIC) TO authenticated;

-- ----------------------------------------------------------------
-- fn_criar_orcamento_complementar — mesma ideia.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento_complementar(
  p_cd_processo UUID,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB,
  p_ds_inscricao_municipal VARCHAR DEFAULT NULL,
  p_vl_transacao NUMERIC DEFAULT NULL,
  p_vl_venal NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_orcamento UUID;
  v_tp_processo VARCHAR(12);
  v_vl_total_honorarios NUMERIC(15,2);
  v_vl_total_custas NUMERIC(15,2);
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Apenas Master ou Jurídico podem criar orçamentos.';
  END IF;

  SELECT tp_processo INTO v_tp_processo FROM soma.processos WHERE cd_processo = p_cd_processo;

  IF v_tp_processo IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item de serviço.';
  END IF;

  PERFORM soma.fn_validar_itens_tipo_processo(v_tp_processo, p_itens);

  SELECT
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'honorario'), 0),
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'custa'), 0)
  INTO v_vl_total_honorarios, v_vl_total_custas
  FROM jsonb_array_elements(p_itens) AS item;

  INSERT INTO soma.orcamentos (
    cd_processo, cd_criador, nm_cidade, dt_validade, vl_total_honorarios, vl_total_custas,
    ds_inscricao_municipal, vl_transacao, vl_venal
  )
  VALUES (
    p_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas,
    p_ds_inscricao_municipal, p_vl_transacao, p_vl_venal
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

GRANT EXECUTE ON FUNCTION soma.fn_criar_orcamento_complementar(UUID, VARCHAR, DATE, JSONB, VARCHAR, NUMERIC, NUMERIC) TO authenticated;

-- ----------------------------------------------------------------
-- fn_obter_orcamento_por_token — inclui os campos novos na resposta
-- (usado pela página pública de aceite).
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
    'ds_inscricao_municipal', o.ds_inscricao_municipal,
    'vl_transacao', o.vl_transacao,
    'vl_venal', o.vl_venal,
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
          'tp_secao', os.tp_secao,
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

  RETURN v_resultado;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_obter_orcamento_por_token TO anon, authenticated;
