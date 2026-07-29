-- ================================================================
-- SOMA — Migration 014
-- Novo fluxo de orçamento (conforme fluxograma): a primeira escolha,
-- fixa e única, é se o orçamento é de "Despachante Imobiliário" (o
-- catálogo CRI/NOTAS/RCPN/SEFAZ/... que já existia) ou de "Contrato
-- Imobiliário" (8 itens novos: compra e venda com financiamento/à
-- vista/consórcio, distrato, aditivo contratual, cessão de direitos,
-- permuta, outro contrato). Cidade continua sendo a segunda escolha
-- fixa, só que relevante apenas pro catálogo de Despachante — os itens
-- de Contrato entram como valor variável (sem tabela de preço ainda).
--
-- A regra "nunca mistura os dois tipos no mesmo orçamento" é validada
-- aqui dentro das próprias RPCs de criação, não só na UI — segurança
-- de verdade, não só cosmética.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. Coluna nova em soma.orcamentos
-- ----------------------------------------------------------------
ALTER TABLE soma.orcamentos
  ADD COLUMN tp_orcamento VARCHAR(12) NOT NULL DEFAULT 'despachante'
    CHECK (tp_orcamento IN ('despachante', 'contrato'));

-- ----------------------------------------------------------------
-- 2. Os 8 itens de Contrato Imobiliário — todos valor variável por
-- enquanto (sem preço definido ainda).
-- ----------------------------------------------------------------
INSERT INTO soma.servicos (cd_codigo, tp_local, nm_categoria, nm_servico, tp_servico, sn_valor_variavel, sn_ativo)
VALUES
  (NULL, 'CONTRATO', 'Contrato Imobiliário', 'Compra e venda com financiamento', 'honorario', true, true),
  (NULL, 'CONTRATO', 'Contrato Imobiliário', 'Compra e venda à vista', 'honorario', true, true),
  (NULL, 'CONTRATO', 'Contrato Imobiliário', 'Compra e venda com consórcio', 'honorario', true, true),
  (NULL, 'CONTRATO', 'Contrato Imobiliário', 'Distrato', 'honorario', true, true),
  (NULL, 'CONTRATO', 'Contrato Imobiliário', 'Aditivo Contratual', 'honorario', true, true),
  (NULL, 'CONTRATO', 'Contrato Imobiliário', 'Cessão de direitos', 'honorario', true, true),
  (NULL, 'CONTRATO', 'Contrato Imobiliário', 'Permuta', 'honorario', true, true),
  (NULL, 'CONTRATO', 'Contrato Imobiliário', 'Outro contrato', 'honorario', true, true);

-- ----------------------------------------------------------------
-- 3. Helper de validação — reaproveitado pelas duas RPCs de criação.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_validar_itens_tipo_orcamento(p_tp_orcamento VARCHAR, p_itens JSONB)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_qtd_incompativel INTEGER;
BEGIN
  IF p_tp_orcamento = 'contrato' THEN
    SELECT count(*) INTO v_qtd_incompativel
    FROM jsonb_array_elements(p_itens) item
    JOIN soma.servicos s ON s.cd_servico = NULLIF(item->>'cd_servico', '')::uuid
    WHERE s.tp_local IS DISTINCT FROM 'CONTRATO';

    IF v_qtd_incompativel > 0 THEN
      RAISE EXCEPTION 'Orçamento de Contrato Imobiliário só pode ter itens da categoria Contrato.';
    END IF;
  ELSE
    SELECT count(*) INTO v_qtd_incompativel
    FROM jsonb_array_elements(p_itens) item
    JOIN soma.servicos s ON s.cd_servico = NULLIF(item->>'cd_servico', '')::uuid
    WHERE s.tp_local = 'CONTRATO';

    IF v_qtd_incompativel > 0 THEN
      RAISE EXCEPTION 'Orçamento de Despachante não pode incluir itens de Contrato Imobiliário.';
    END IF;
  END IF;
END;
$$;

-- ----------------------------------------------------------------
-- 4. fn_criar_orcamento — ganha p_tp_orcamento. Assinatura mudou
-- (parâmetro novo), então precisa derrubar a versão antiga antes,
-- senão CREATE OR REPLACE cria uma segunda sobrecarga em vez de
-- substituir (mesma pegadinha da migration 007).
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS soma.fn_criar_orcamento(soma.type_processo, UUID, VARCHAR, VARCHAR, VARCHAR, DATE, JSONB);

CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento(
  p_tp_processo soma.type_processo,
  p_cd_imobiliaria UUID,
  p_nm_comprador_convidado VARCHAR,
  p_ds_telefone_comprador_convidado VARCHAR,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB,
  p_tp_orcamento VARCHAR DEFAULT 'despachante'
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

  PERFORM soma.fn_validar_itens_tipo_orcamento(p_tp_orcamento, p_itens);

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

  INSERT INTO soma.orcamentos (cd_processo, cd_criador, nm_cidade, dt_validade, vl_total_honorarios, vl_total_custas, tp_orcamento)
  VALUES (v_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas, p_tp_orcamento)
  RETURNING cd_orcamento INTO v_cd_orcamento;

  INSERT INTO soma.orcamento_servicos (cd_orcamento, cd_servico, ds_descricao, tp_servico, vl_unitario, nr_quantidade)
  SELECT
    v_cd_orcamento,
    NULLIF(item->>'cd_servico', '')::uuid,
    item->>'ds_descricao',
    (item->>'tp_servico')::soma.type_servico,
    (item->>'vl_unitario')::numeric,
    (item->>'nr_quantidade')::integer
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN v_cd_orcamento;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_criar_orcamento(soma.type_processo, UUID, VARCHAR, VARCHAR, VARCHAR, DATE, JSONB, VARCHAR) TO authenticated;

-- ----------------------------------------------------------------
-- 5. fn_criar_orcamento_complementar — mesma mudança.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS soma.fn_criar_orcamento_complementar(UUID, VARCHAR, DATE, JSONB);

CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento_complementar(
  p_cd_processo UUID,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB,
  p_tp_orcamento VARCHAR DEFAULT 'despachante'
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_orcamento UUID;
  v_vl_total_honorarios NUMERIC(15,2);
  v_vl_total_custas NUMERIC(15,2);
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Apenas Master ou Jurídico podem criar orçamentos.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM soma.processos WHERE cd_processo = p_cd_processo) THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item de serviço.';
  END IF;

  PERFORM soma.fn_validar_itens_tipo_orcamento(p_tp_orcamento, p_itens);

  SELECT
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'honorario'), 0),
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'custa'), 0)
  INTO v_vl_total_honorarios, v_vl_total_custas
  FROM jsonb_array_elements(p_itens) AS item;

  INSERT INTO soma.orcamentos (cd_processo, cd_criador, nm_cidade, dt_validade, vl_total_honorarios, vl_total_custas, tp_orcamento)
  VALUES (p_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas, p_tp_orcamento)
  RETURNING cd_orcamento INTO v_cd_orcamento;

  INSERT INTO soma.orcamento_servicos (cd_orcamento, cd_servico, ds_descricao, tp_servico, vl_unitario, nr_quantidade)
  SELECT
    v_cd_orcamento,
    NULLIF(item->>'cd_servico', '')::uuid,
    item->>'ds_descricao',
    (item->>'tp_servico')::soma.type_servico,
    (item->>'vl_unitario')::numeric,
    (item->>'nr_quantidade')::integer
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN v_cd_orcamento;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_criar_orcamento_complementar(UUID, VARCHAR, DATE, JSONB, VARCHAR) TO authenticated;

-- ----------------------------------------------------------------
-- 6. fn_obter_orcamento_por_token — passa a devolver tp_orcamento
-- também (assinatura não muda, então CREATE OR REPLACE já basta).
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
    'tp_orcamento', o.tp_orcamento,
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
