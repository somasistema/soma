-- ================================================================
-- SOMA — Migration 034
-- Reverter uma alteração registrada no log de auditoria (só Master,
-- só pra Processos/Orçamentos/Itens de orçamento — o que o histórico
-- da tela de processo mostra). Escopo desta primeira versão: só
-- reverte edições (UPDATE) — desfazer uma criação ou restaurar uma
-- exclusão fica pra depois, é um caso bem mais raro e arriscado.
--
-- Orçamentos: NUNCA reverte status (tp_status, ts_aceite,
-- vl_total_aceito) — decisão explícita, porque isso tem efeito
-- legal/financeiro (ex: voltar um orçamento "pago" pra "pendente")
-- e não deveria acontecer só com um clique num histórico.
-- ================================================================

CREATE OR REPLACE FUNCTION soma.fn_reverter_log(p_cd_log UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_log soma.log_auditoria%ROWTYPE;
BEGIN
  IF soma.fn_auth_role() != 'master' THEN
    RAISE EXCEPTION 'Só Master pode reverter alterações do histórico.';
  END IF;

  SELECT * INTO v_log FROM soma.log_auditoria WHERE cd_log = p_cd_log;

  IF v_log.cd_log IS NULL THEN
    RAISE EXCEPTION 'Evento de histórico não encontrado.';
  END IF;

  IF v_log.tp_operacao != 'UPDATE' THEN
    RAISE EXCEPTION 'Só dá pra reverter edições — esse evento é uma criação ou exclusão.';
  END IF;

  IF v_log.nm_tabela = 'processos' THEN
    UPDATE soma.processos
    SET
      nm_comprador_convidado = v_log.dados_antigos->>'nm_comprador_convidado',
      ds_telefone_comprador_convidado = v_log.dados_antigos->>'ds_telefone_comprador_convidado',
      cd_imobiliaria = NULLIF(v_log.dados_antigos->>'cd_imobiliaria', '')::uuid,
      ds_observacoes_juridicas = v_log.dados_antigos->>'ds_observacoes_juridicas'
    WHERE cd_processo = v_log.cd_registro::uuid;

  ELSIF v_log.nm_tabela = 'orcamentos' THEN
    UPDATE soma.orcamentos
    SET
      nm_cidade = v_log.dados_antigos->>'nm_cidade',
      dt_validade = (v_log.dados_antigos->>'dt_validade')::date,
      ds_inscricao_municipal = v_log.dados_antigos->>'ds_inscricao_municipal',
      vl_transacao = NULLIF(v_log.dados_antigos->>'vl_transacao', '')::numeric,
      vl_venal = NULLIF(v_log.dados_antigos->>'vl_venal', '')::numeric,
      vl_total_honorarios = (v_log.dados_antigos->>'vl_total_honorarios')::numeric,
      vl_total_custas = (v_log.dados_antigos->>'vl_total_custas')::numeric
      -- tp_status, ts_aceite, vl_total_aceito, cd_token_aceite e
      -- ds_pdf_url propositalmente de fora.
    WHERE cd_orcamento = v_log.cd_registro::uuid;

  ELSIF v_log.nm_tabela = 'orcamento_servicos' THEN
    UPDATE soma.orcamento_servicos
    SET
      ds_descricao = v_log.dados_antigos->>'ds_descricao',
      tp_servico = (v_log.dados_antigos->>'tp_servico')::soma.type_servico,
      vl_unitario = (v_log.dados_antigos->>'vl_unitario')::numeric,
      nr_quantidade = (v_log.dados_antigos->>'nr_quantidade')::integer,
      tp_secao = v_log.dados_antigos->>'tp_secao'
    WHERE cd_orcamento_servico = v_log.cd_registro::uuid;

  ELSE
    RAISE EXCEPTION 'Reverter não é suportado pra %.', v_log.nm_tabela;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_reverter_log(UUID) TO authenticated;
