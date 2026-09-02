-- ================================================================
-- SOMA — Migration 045
-- Assinatura digital do contrato final (Autentique). Quando as 5
-- frentes aprovam a minuta, a aplicação gera o contrato (migration
-- 041) e o envia pra assinatura das 5 mesmas frentes. O provedor
-- (Autentique) fica atrás de uma interface no código — enquanto não
-- houver token configurado, o contrato só fica em
-- 'aguardando_assinatura' e nada é enviado.
--
-- Escrita das colunas/linhas de assinatura só pela aplicação
-- (service_role: server action que fecha a 5ª aprovação e o webhook
-- da Autentique), mesmo esquema do webhook do Mercado Pago e do OCR.
-- Leitura acompanha quem já enxerga o processo.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) soma.contratos — dados do envio pra assinatura.
-- ----------------------------------------------------------------
ALTER TABLE soma.contratos DROP CONSTRAINT IF EXISTS contratos_tp_status_check;

ALTER TABLE soma.contratos
  ADD COLUMN ds_provedor_assinatura VARCHAR(30),
  ADD COLUMN ds_documento_externo_id TEXT,     -- id do documento no provedor
  ADD COLUMN ds_url_documento TEXT,            -- link pra acompanhar no provedor
  ADD COLUMN ds_arquivo_assinado_url TEXT,     -- path no bucket 'minutas' do PDF final
  ADD COLUMN ds_erro_envio TEXT,
  ADD COLUMN ts_envio_assinatura TIMESTAMPTZ,
  ADD COLUMN ts_assinatura_concluida TIMESTAMPTZ;

ALTER TABLE soma.contratos
  ADD CONSTRAINT contratos_tp_status_check CHECK (tp_status IN (
    'aguardando_assinatura', -- contrato gerado, ainda não enviado
    'enviado',               -- no provedor, aguardando as assinaturas
    'assinado',              -- todas as 5 frentes assinaram
    'recusado',              -- uma frente recusou
    'cancelado'              -- envio cancelado / documento removido no provedor
  ));

-- ----------------------------------------------------------------
-- 2) Signatários — 5 linhas por contrato, uma por frente. nm/email
--    são congelados no envio (o provedor manda o e-mail pra eles).
-- ----------------------------------------------------------------
CREATE TABLE soma.contrato_signatarios (
  cd_signatario UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_contrato UUID NOT NULL REFERENCES soma.contratos(cd_contrato) ON DELETE CASCADE,
  tp_papel VARCHAR(20) NOT NULL
    CHECK (tp_papel IN ('corretor', 'comprador', 'vendedor', 'imobiliaria', 'juridico')),
  cd_usuario UUID REFERENCES soma.usuarios(cd_usuario),
  nm_signatario VARCHAR(255) NOT NULL,
  ds_email VARCHAR(255) NOT NULL,
  tp_status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (tp_status IN ('pendente', 'assinado', 'recusado')),
  ds_assinatura_externo_id TEXT,   -- public_id da assinatura no provedor (casa com o webhook)
  ds_url_assinatura TEXT,          -- link individual de assinatura
  ts_assinatura TIMESTAMPTZ,
  UNIQUE (cd_contrato, tp_papel)
);

CREATE INDEX idx_contrato_signatarios_contrato ON soma.contrato_signatarios(cd_contrato);
CREATE INDEX idx_contrato_signatarios_externo ON soma.contrato_signatarios(ds_assinatura_externo_id);

-- ----------------------------------------------------------------
-- 3) RLS — leitura acompanha soma.contratos_select; escrita só
--    service_role (aplicação).
-- ----------------------------------------------------------------
ALTER TABLE soma.contrato_signatarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contrato_signatarios_select" ON soma.contrato_signatarios FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.contratos c
      WHERE c.cd_contrato = contrato_signatarios.cd_contrato
      AND soma.fn_pode_ver_processo(c.cd_processo)
    )
  );

-- ----------------------------------------------------------------
-- 4) Quando todas as frentes assinam, o webhook marca o contrato
--    'assinado' e fecha a etapa do processo. Função SECURITY DEFINER
--    pra concentrar essa transição num lugar só (o webhook chama).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_concluir_assinatura_contrato(p_cd_contrato UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
  v_pendentes INTEGER;
BEGIN
  SELECT cd_processo INTO v_cd_processo FROM soma.contratos WHERE cd_contrato = p_cd_contrato;
  IF v_cd_processo IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado.';
  END IF;

  SELECT count(*) INTO v_pendentes
  FROM soma.contrato_signatarios
  WHERE cd_contrato = p_cd_contrato AND tp_status <> 'assinado';

  IF v_pendentes > 0 THEN
    RETURN; -- ainda falta alguém
  END IF;

  UPDATE soma.contratos
  SET tp_status = 'assinado', ts_assinatura_concluida = now()
  WHERE cd_contrato = p_cd_contrato AND tp_status <> 'assinado';

  UPDATE soma.processos
  SET tp_etapa_contrato = 'concluido'
  WHERE cd_processo = v_cd_processo;

  PERFORM soma.fn_registrar_andamento(
    v_cd_processo,
    'Contrato assinado',
    'Todas as 5 frentes assinaram o contrato digitalmente — processo concluído.'
  );
END;
$$;
