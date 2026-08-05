-- ================================================================
-- SOMA — Migration 026
-- Permite editar um orçamento já criado (tela /orcamentos/[id]/editar).
-- Só dá pra editar enquanto o orçamento está 'pendente' — depois que
-- o cliente aceita ou paga, o conteúdo fica travado (mudar itens
-- depois do aceite invalidaria o que a pessoa efetivamente aceitou).
--
-- Estratégia: substitui TODOS os itens (delete + insert), igual o
-- criar orçamento faz — mais simples e seguro que tentar dar match
-- item a item pra fazer update parcial.
-- ================================================================

CREATE OR REPLACE FUNCTION soma.fn_atualizar_orcamento(
  p_cd_orcamento UUID,
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
  v_tp_processo VARCHAR(12);
  v_tp_status VARCHAR(12);
  v_vl_total_honorarios NUMERIC(15,2);
  v_vl_total_custas NUMERIC(15,2);
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Apenas Master ou Jurídico podem editar orçamentos.';
  END IF;

  SELECT p.tp_processo, o.tp_status INTO v_tp_processo, v_tp_status
  FROM soma.orcamentos o
  JOIN soma.processos p ON p.cd_processo = o.cd_processo
  WHERE o.cd_orcamento = p_cd_orcamento;

  IF v_tp_processo IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  IF v_tp_status != 'pendente' THEN
    RAISE EXCEPTION 'Só é possível editar orçamentos com status pendente (esse já foi % pelo cliente).', v_tp_status;
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

  UPDATE soma.orcamentos
  SET
    nm_cidade = p_nm_cidade,
    dt_validade = p_dt_validade,
    ds_inscricao_municipal = p_ds_inscricao_municipal,
    vl_transacao = p_vl_transacao,
    vl_venal = p_vl_venal,
    vl_total_honorarios = v_vl_total_honorarios,
    vl_total_custas = v_vl_total_custas
  WHERE cd_orcamento = p_cd_orcamento;

  DELETE FROM soma.orcamento_servicos WHERE cd_orcamento = p_cd_orcamento;

  INSERT INTO soma.orcamento_servicos (cd_orcamento, cd_servico, ds_descricao, tp_servico, vl_unitario, nr_quantidade, tp_secao)
  SELECT
    p_cd_orcamento,
    NULLIF(item->>'cd_servico', '')::uuid,
    item->>'ds_descricao',
    (item->>'tp_servico')::soma.type_servico,
    (item->>'vl_unitario')::numeric,
    (item->>'nr_quantidade')::integer,
    COALESCE(NULLIF(item->>'tp_secao', ''), 'inicial')
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN p_cd_orcamento;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_atualizar_orcamento(UUID, VARCHAR, DATE, JSONB, VARCHAR, NUMERIC, NUMERIC) TO authenticated;
