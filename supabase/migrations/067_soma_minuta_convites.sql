-- ================================================================
-- SOMA — Migration 067
-- Aprovação da minuta por e-mail: cada pessoa das frentes (corretor,
-- comprador, vendedor, imobiliária) recebe um link, lê o PDF da minuta
-- e aceita ou recusa (recusa exige o motivo), sem login — mesmo esquema
-- do /parte/[token]: token na linha + RPCs SECURITY DEFINER.
--
--   * um convite por PESSOA e por versão da minuta (o id é o token);
--   * a frente (papel) só fica "aprovada" quando todas as pessoas dela
--     aceitaram; uma recusa reprova a minuta, igual à reprovação feita
--     dentro do sistema (fn_decidir_minuta);
--   * o Jurídico continua decidindo dentro do sistema;
--   * quando a última frente aprova, o contrato final é gerado (a app
--     depois manda pra assinatura).
-- ================================================================

CREATE TABLE IF NOT EXISTS soma.minuta_convites (
  cd_convite UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_minuta UUID NOT NULL REFERENCES soma.minutas(cd_minuta) ON DELETE CASCADE,
  tp_papel VARCHAR(20) NOT NULL
    CHECK (tp_papel IN ('corretor', 'comprador', 'vendedor', 'imobiliaria', 'juridico')),
  nm_destinatario VARCHAR(255) NOT NULL,
  ds_email VARCHAR(255) NOT NULL,
  tp_status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (tp_status IN ('pendente', 'aprovada', 'reprovada')),
  ds_comentario TEXT,
  ts_envio TIMESTAMPTZ DEFAULT now() NOT NULL,  -- último envio do e-mail
  ts_decisao TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_minuta_convites_minuta ON soma.minuta_convites (cd_minuta);
CREATE UNIQUE INDEX IF NOT EXISTS uq_minuta_convites_email
  ON soma.minuta_convites (cd_minuta, lower(ds_email));

ALTER TABLE soma.minuta_convites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minuta_convites_select" ON soma.minuta_convites;
CREATE POLICY "minuta_convites_select" ON soma.minuta_convites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.minutas m
      WHERE m.cd_minuta = minuta_convites.cd_minuta
        AND soma.fn_pode_ver_processo(m.cd_processo)
    )
  );
-- Escrita: só o servidor (service_role) e as funções abaixo.

-- ----------------------------------------------------------------
-- 1) Fecha a minuta quando as 5 frentes aprovaram: gera o contrato
--    final (a mesma regra do fim de fn_decidir_minuta).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_fechar_minuta_se_aprovada(p_cd_minuta UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
  v_pendentes INTEGER;
BEGIN
  SELECT cd_processo INTO v_cd_processo FROM soma.minutas WHERE cd_minuta = p_cd_minuta;

  SELECT count(*) INTO v_pendentes
  FROM soma.minuta_aprovacoes
  WHERE cd_minuta = p_cd_minuta AND tp_status <> 'aprovada';

  IF v_pendentes > 0 OR EXISTS (SELECT 1 FROM soma.contratos WHERE cd_minuta = p_cd_minuta) THEN
    RETURN;
  END IF;

  UPDATE soma.minutas SET tp_status = 'aprovada' WHERE cd_minuta = p_cd_minuta;
  INSERT INTO soma.contratos (cd_processo, cd_minuta) VALUES (v_cd_processo, p_cd_minuta);
  UPDATE soma.processos SET tp_etapa_contrato = 'aguardando_assinatura'
  WHERE cd_processo = v_cd_processo;
  PERFORM soma.fn_registrar_andamento(
    v_cd_processo,
    'Contrato final gerado',
    'Todas as 5 frentes aprovaram a minuta — contrato final gerado, aguardando assinatura digital.'
  );
END;
$$;

REVOKE ALL ON FUNCTION soma.fn_fechar_minuta_se_aprovada(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- 2) Dados do convite pelo token (NULL se não existe) — alimenta a
--    página pública.
-- ----------------------------------------------------------------
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
    'pode_decidir', (
      c.tp_status = 'pendente'
      AND m.tp_status = 'em_aprovacao'
      AND m.nr_versao = (
        SELECT max(m2.nr_versao) FROM soma.minutas m2 WHERE m2.cd_processo = m.cd_processo
      )
      AND a.tp_status = 'pendente'
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

-- ----------------------------------------------------------------
-- 3) Decisão pelo link: aceitar ou recusar (recusa exige o motivo).
-- ----------------------------------------------------------------
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
BEGIN
  SELECT * INTO c FROM soma.minuta_convites WHERE cd_convite = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;

  SELECT * INTO m FROM soma.minutas WHERE cd_minuta = c.cd_minuta FOR UPDATE;

  IF c.tp_status <> 'pendente' THEN
    RAISE EXCEPTION 'Você já respondeu a esta minuta.';
  END IF;

  IF m.tp_status <> 'em_aprovacao'
     OR m.nr_versao <> (SELECT max(nr_versao) FROM soma.minutas WHERE cd_processo = m.cd_processo) THEN
    RAISE EXCEPTION 'Esta versão da minuta não está mais em aprovação. Se houver uma nova versão, você receberá outro link.';
  END IF;

  IF NOT p_aprovar AND v_motivo IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da recusa.';
  END IF;

  SELECT tp_status INTO v_papel_status
  FROM soma.minuta_aprovacoes WHERE cd_minuta = c.cd_minuta AND tp_papel = c.tp_papel;
  IF v_papel_status IS DISTINCT FROM 'pendente' THEN
    RAISE EXCEPTION 'Esta frente já foi decidida pela equipe.';
  END IF;

  UPDATE soma.minuta_convites
  SET tp_status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'reprovada' END,
      ds_comentario = v_motivo,
      ts_decisao = now()
  WHERE cd_convite = p_token;

  v_rotulo := initcap(c.tp_papel);

  IF NOT p_aprovar THEN
    UPDATE soma.minuta_aprovacoes
    SET tp_status = 'reprovada',
        ds_comentario = c.nm_destinatario || ': ' || v_motivo,
        ts_decisao = now()
    WHERE cd_minuta = c.cd_minuta AND tp_papel = c.tp_papel;

    UPDATE soma.minutas SET tp_status = 'reprovada' WHERE cd_minuta = c.cd_minuta;
    UPDATE soma.processos SET tp_etapa_contrato = 'minuta_reprovada'
    WHERE cd_processo = m.cd_processo;

    PERFORM soma.fn_registrar_andamento(
      m.cd_processo,
      'Minuta reprovada',
      c.nm_destinatario || ' (' || v_rotulo || ') recusou a minuta — Motivo: ' || v_motivo
    );
    RETURN;
  END IF;

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

  UPDATE soma.minuta_aprovacoes
  SET tp_status = 'aprovada', ts_decisao = now()
  WHERE cd_minuta = c.cd_minuta AND tp_papel = c.tp_papel;

  PERFORM soma.fn_registrar_andamento(
    m.cd_processo,
    'Minuta aprovada por uma frente',
    v_rotulo || ' aprovou a minuta (' || c.nm_destinatario || ').'
  );

  PERFORM soma.fn_fechar_minuta_se_aprovada(c.cd_minuta);
END;
$$;

REVOKE ALL ON FUNCTION soma.fn_decidir_minuta_convite(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soma.fn_decidir_minuta_convite(UUID, BOOLEAN, TEXT) TO anon, authenticated;
