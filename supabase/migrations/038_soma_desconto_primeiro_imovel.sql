-- ================================================================
-- SOMA — Migration 038
-- Nova regra: desconto de 50% pra cliente em "primeiro imóvel" ou
-- "primeiro financiamento". Só uma PARTE das taxas/emolumentos recebe
-- esse desconto — lista exata ainda pendente (Milena vai confirmar
-- quais atos entram). Em vez de travar a feature nisso, criamos um
-- flag por taxa (sn_desconto_primeiro_imovel, default false — ninguém
-- ganha desconto até alguém marcar explicitamente) que o Master liga
-- em Configurações > Taxas e Emolumentos assim que a lista chegar,
-- sem precisar de mais nenhuma mudança de código.
--
-- orcamentos.sn_primeiro_imovel guarda se aquele orçamento específico
-- foi marcado como primeiro imóvel/financiamento (auditoria/histórico
-- de quais orçamentos usaram o benefício) — o desconto em si já vem
-- aplicado no vl_unitario de cada item elegível, calculado no
-- client (orcamento-form.tsx) antes de mandar pra fn_criar_orcamento.
-- ================================================================

ALTER TABLE soma.tabela_custas
  ADD COLUMN sn_desconto_primeiro_imovel BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE soma.orcamentos
  ADD COLUMN sn_primeiro_imovel BOOLEAN NOT NULL DEFAULT false;

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
  p_sn_primeiro_imovel BOOLEAN DEFAULT false
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
