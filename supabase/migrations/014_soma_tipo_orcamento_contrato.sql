-- ================================================================
-- SOMA — Migration 014
-- Novo fluxo de orçamento (conforme fluxograma): a única escolha fixa
-- é o TIPO DE PROCESSO — "Despachante Imobiliário" (o catálogo
-- CRI/NOTAS/RCPN/SEFAZ/... que já existia) ou "Contrato Imobiliário"
-- (8 itens novos: compra e venda com financiamento/à vista/consórcio,
-- distrato, aditivo contratual, cessão de direitos, permuta, outro
-- contrato). Cidade continua sendo a segunda escolha fixa. O restante
-- (órgão, categoria, item) aceita múltiplas seleções.
--
-- soma.type_processo tinha 6 valores de um rascunho antigo que nunca
-- correspondeu ao negócio real (a_vista, financiamento, consorcio,
-- locacao, averbacao, inventario) — esses viram "Compra e venda..."
-- que agora são itens DENTRO do catálogo de Contrato, não mais o tipo
-- do processo. O tipo do processo passa a ser só os dois valores do
-- fluxograma. Como o tipo é uma característica do PROCESSO (fixado
-- na criação do orçamento original), o orçamento complementar não
-- pergunta de novo — ele herda o tp_processo do processo já existente.
--
-- A regra "nunca mistura os dois tipos no mesmo orçamento" é validada
-- aqui dentro das próprias RPCs de criação, não só na UI.
-- ================================================================

-- ----------------------------------------------------------------
-- 0. Limpeza da PRIMEIRA versão desta migration, que chegou a rodar
-- com sucesso antes do modelo ser corrigido pra usar tp_processo em
-- vez de uma coluna tp_orcamento à parte. Tudo aqui é idempotente —
-- roda sem erro mesmo que nada disso exista.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS soma.fn_criar_orcamento(soma.type_processo, UUID, VARCHAR, VARCHAR, VARCHAR, DATE, JSONB, VARCHAR);
DROP FUNCTION IF EXISTS soma.fn_criar_orcamento_complementar(UUID, VARCHAR, DATE, JSONB, VARCHAR);
DROP FUNCTION IF EXISTS soma.fn_validar_itens_tipo_orcamento(VARCHAR, JSONB);
ALTER TABLE soma.orcamentos DROP COLUMN IF EXISTS tp_orcamento;

-- ----------------------------------------------------------------
-- 1. Os 8 itens de Contrato Imobiliário — todos valor variável por
-- enquanto (sem preço definido ainda). Guarda de idempotência: a
-- primeira versão desta migration já pode tê-los inserido.
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM soma.servicos WHERE tp_local = 'CONTRATO') THEN
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
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 2. soma.processos.tp_processo passa a ser VARCHAR com só 2 valores
-- em vez do enum antigo de 6 valores. Os processos já existentes (só
-- havia 'a_vista'/'financiamento' em uso real) migram para
-- 'despachante', que é o comportamento que já tinham até aqui.
-- ----------------------------------------------------------------
-- VARCHAR sem tamanho aqui (não VARCHAR(12)) porque o cast roda ANTES
-- do UPDATE abaixo — os valores antigos do enum ainda estão na coluna
-- nesse instante, e 'financiamento' tem 13 caracteres.
ALTER TABLE soma.processos ALTER COLUMN tp_processo TYPE VARCHAR USING tp_processo::text;
ALTER TABLE soma.processos ALTER COLUMN tp_processo DROP DEFAULT;

UPDATE soma.processos SET tp_processo = 'despachante' WHERE tp_processo NOT IN ('despachante', 'contrato');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_processos_tp_processo'
  ) THEN
    ALTER TABLE soma.processos
      ADD CONSTRAINT chk_processos_tp_processo CHECK (tp_processo IN ('despachante', 'contrato'));
  END IF;
END $$;

-- Só soma.processos.tp_processo usava esse enum — livre pra derrubar,
-- mas as funções abaixo precisam parar de referenciá-lo primeiro.
DROP FUNCTION IF EXISTS soma.fn_criar_orcamento(soma.type_processo, UUID, VARCHAR, VARCHAR, VARCHAR, DATE, JSONB);
DROP TYPE IF EXISTS soma.type_processo;

-- ----------------------------------------------------------------
-- 3. Helper de validação — reaproveitado pelas duas RPCs de criação.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_validar_itens_tipo_processo(p_tp_processo VARCHAR, p_itens JSONB)
RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_qtd_incompativel INTEGER;
BEGIN
  IF p_tp_processo = 'contrato' THEN
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
-- 4. fn_criar_orcamento — p_tp_processo passa de soma.type_processo
-- pra VARCHAR(12). Assinatura muda de tipo, então precisa recriar (já
-- derrubada a versão antiga acima, junto com o enum).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento(
  p_tp_processo VARCHAR(12),
  p_cd_imobiliaria UUID,
  p_nm_comprador_convidado VARCHAR,
  p_ds_telefone_comprador_convidado VARCHAR,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB
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

  INSERT INTO soma.orcamentos (cd_processo, cd_criador, nm_cidade, dt_validade, vl_total_honorarios, vl_total_custas)
  VALUES (v_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas)
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

GRANT EXECUTE ON FUNCTION soma.fn_criar_orcamento(VARCHAR, UUID, VARCHAR, VARCHAR, VARCHAR, DATE, JSONB) TO authenticated;

-- ----------------------------------------------------------------
-- 5. fn_criar_orcamento_complementar — assinatura NÃO muda (continua
-- só cd_processo/cidade/validade/itens); o tipo é herdado do processo
-- já existente, então CREATE OR REPLACE já basta, sem DROP.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento_complementar(
  p_cd_processo UUID,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB
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

  INSERT INTO soma.orcamentos (cd_processo, cd_criador, nm_cidade, dt_validade, vl_total_honorarios, vl_total_custas)
  VALUES (p_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas)
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

GRANT EXECUTE ON FUNCTION soma.fn_criar_orcamento_complementar(UUID, VARCHAR, DATE, JSONB) TO authenticated;
