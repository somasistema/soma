-- ================================================================
-- SOMA — Migration 004
-- soma.processos e soma.usuarios só têm policy de SELECT (por design:
-- só Master/Jurídico devem poder criar processo+orçamento, e a
-- criação envolve 3 inserts que precisam ser atômicos). Em vez de
-- abrir INSERT direto pra processos via RLS, criação de orçamento
-- passa por esta função SECURITY DEFINER, chamada via supabase.rpc().
-- ================================================================
CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento(
  p_tp_processo soma.type_processo,
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

GRANT EXECUTE ON FUNCTION soma.fn_criar_orcamento TO authenticated;
