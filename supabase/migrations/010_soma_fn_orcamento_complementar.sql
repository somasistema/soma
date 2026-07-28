-- ================================================================
-- SOMA — Migration 010
-- soma.fn_criar_orcamento cria sempre processo + orçamento juntos.
-- "Orçamento complementar" (Cláusula 2 da Fase 1: "orçamento
-- complementar... pelo Despachante") é um NOVO orçamento vinculado a
-- um processo JÁ EXISTENTE — ex: o órgão competente pede um serviço
-- adicional não previsto no orçamento original. Mesma regra de
-- autorização de fn_criar_orcamento (só Master/Jurídico criam
-- orçamento), só que sem o INSERT em soma.processos.
-- ================================================================
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

GRANT EXECUTE ON FUNCTION soma.fn_criar_orcamento_complementar TO authenticated;
