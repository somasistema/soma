-- ================================================================
-- SOMA — Migration 073
-- Aceitar também vale depois que outra parte recusou. Na 071 quem ainda
-- não tinha respondido só podia recusar/pedir alteração; agora pode
-- aceitar ou recusar, em qualquer ordem, enquanto a versão for a atual.
--
-- Aceitar uma versão já recusada só registra a posição da pessoa (a frente
-- dela fica "aprovada" quando todos dela aceitam) — o contrato só é gerado
-- quando a versão está em aprovação e as 5 frentes aprovaram, então a equipe
-- ainda precisa gerar uma versão nova. Reemite as funções da 071.
-- ================================================================

CREATE OR REPLACE FUNCTION soma.fn_minuta_convite_por_token(p_token UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
  SELECT jsonb_build_object(
    'nm_destinatario', c.nm_destinatario,
    'tp_papel', c.tp_papel,
    'tp_status', c.tp_status,
    'ds_comentario', c.ds_comentario,
    'ds_numero_processo', p.ds_numero_processo,
    'nr_versao', m.nr_versao,
    'tp_status_minuta', m.tp_status,
    'versao_atual', m.nr_versao = (
      SELECT max(m2.nr_versao) FROM soma.minutas m2 WHERE m2.cd_processo = m.cd_processo
    ),
    -- Pode aceitar ou recusar: versão atual, ainda não respondeu, e a minuta
    -- está em aprovação ou já foi recusada por outra parte.
    'pode_decidir', (
      c.tp_status = 'pendente'
      AND m.tp_status IN ('em_aprovacao', 'reprovada')
      AND m.nr_versao = (
        SELECT max(m2.nr_versao) FROM soma.minutas m2 WHERE m2.cd_processo = m.cd_processo
      )
      AND (a.tp_status = 'pendente' OR m.tp_status = 'reprovada')
    )
  )
  FROM soma.minuta_convites c
  JOIN soma.minutas m ON m.cd_minuta = c.cd_minuta
  JOIN soma.processos p ON p.cd_processo = m.cd_processo
  JOIN soma.minuta_aprovacoes a ON a.cd_minuta = c.cd_minuta AND a.tp_papel = c.tp_papel
  WHERE c.cd_convite = p_token;
$$;

REVOKE ALL ON FUNCTION soma.fn_minuta_convite_por_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soma.fn_minuta_convite_por_token(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION soma.fn_decidir_minuta_convite(
  p_token UUID,
  p_aprovar BOOLEAN,
  p_comentario TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  c soma.minuta_convites%ROWTYPE;
  m soma.minutas%ROWTYPE;
  v_papel_status VARCHAR;
  v_motivo TEXT := NULLIF(trim(COALESCE(p_comentario, '')), '');
  v_rotulo VARCHAR;
  v_faltam INTEGER;
  v_ja_reprovada BOOLEAN;
BEGIN
  SELECT * INTO c FROM soma.minuta_convites WHERE cd_convite = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;

  SELECT * INTO m FROM soma.minutas WHERE cd_minuta = c.cd_minuta FOR UPDATE;

  IF c.tp_status <> 'pendente' THEN
    RAISE EXCEPTION 'Você já respondeu a esta minuta.';
  END IF;

  IF m.nr_versao <> (SELECT max(nr_versao) FROM soma.minutas WHERE cd_processo = m.cd_processo) THEN
    RAISE EXCEPTION 'Esta versão da minuta foi substituída por uma mais nova. Procure o e-mail mais recente com o novo link.';
  END IF;

  IF m.tp_status = 'aprovada' THEN
    RAISE EXCEPTION 'Esta minuta já foi aprovada por todas as partes.';
  END IF;

  v_ja_reprovada := (m.tp_status = 'reprovada');

  IF NOT p_aprovar AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Escreva o motivo da recusa ou o que você quer alterar.';
  END IF;

  SELECT tp_status INTO v_papel_status
  FROM soma.minuta_aprovacoes WHERE cd_minuta = c.cd_minuta AND tp_papel = c.tp_papel;
  IF NOT v_ja_reprovada AND v_papel_status IS DISTINCT FROM 'pendente' THEN
    RAISE EXCEPTION 'Esta frente já foi decidida pela equipe.';
  END IF;

  UPDATE soma.minuta_convites
  SET tp_status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'reprovada' END,
      ds_comentario = v_motivo,
      ts_decisao = now()
  WHERE cd_convite = p_token;

  v_rotulo := initcap(c.tp_papel);

  IF NOT p_aprovar THEN
    -- Vários comentários na mesma frente se somam (um por pessoa).
    UPDATE soma.minuta_aprovacoes
    SET ds_comentario = CASE
          WHEN tp_status = 'reprovada' AND ds_comentario IS NOT NULL
            THEN ds_comentario || ' | ' || c.nm_destinatario || ': ' || v_motivo
          ELSE c.nm_destinatario || ': ' || v_motivo
        END,
        tp_status = 'reprovada',
        ts_decisao = now()
    WHERE cd_minuta = c.cd_minuta AND tp_papel = c.tp_papel;

    IF NOT v_ja_reprovada THEN
      UPDATE soma.minutas SET tp_status = 'reprovada' WHERE cd_minuta = c.cd_minuta;
      UPDATE soma.processos SET tp_etapa_contrato = 'minuta_reprovada'
      WHERE cd_processo = m.cd_processo;
    END IF;

    PERFORM soma.fn_registrar_andamento(
      m.cd_processo,
      CASE WHEN v_ja_reprovada THEN 'Alteração pedida na minuta' ELSE 'Minuta reprovada' END,
      c.nm_destinatario || ' (' || v_rotulo || ') '
        || CASE WHEN v_ja_reprovada THEN 'também recusou a minuta' ELSE 'recusou a minuta' END
        || ' — ' || v_motivo
    );
    RETURN;
  END IF;

  -- Aceitou. Se a versão já tinha sido recusada por outra parte, só registra a posição.
  SELECT count(*) INTO v_faltam
  FROM soma.minuta_convites
  WHERE cd_minuta = c.cd_minuta AND tp_papel = c.tp_papel AND tp_status <> 'aprovada';

  IF v_faltam > 0 THEN
    PERFORM soma.fn_registrar_andamento(
      m.cd_processo,
      'Minuta aprovada por um signatário',
      c.nm_destinatario || ' (' || v_rotulo || ') aprovou a minuta; falta o restante dessa frente.'
    );
    RETURN;
  END IF;

  -- Todos da frente aceitaram: a frente fica aprovada (se ainda estava pendente;
  -- uma frente já recusada por alguém dela continua recusada).
  UPDATE soma.minuta_aprovacoes
  SET tp_status = 'aprovada', ts_decisao = now()
  WHERE cd_minuta = c.cd_minuta AND tp_papel = c.tp_papel AND tp_status = 'pendente';

  PERFORM soma.fn_registrar_andamento(
    m.cd_processo,
    'Minuta aprovada por uma frente',
    v_rotulo || ' aprovou a minuta (' || c.nm_destinatario || ')'
      || CASE WHEN v_ja_reprovada THEN ', embora outra parte tenha recusado esta versão.' ELSE '.' END
  );

  -- O contrato só nasce de uma versão em aprovação com as 5 frentes aprovadas.
  IF NOT v_ja_reprovada THEN
    PERFORM soma.fn_fechar_minuta_se_aprovada(c.cd_minuta);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION soma.fn_decidir_minuta_convite(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soma.fn_decidir_minuta_convite(UUID, BOOLEAN, TEXT) TO anon, authenticated;
