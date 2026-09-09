-- ================================================================
-- SOMA — Migration 051
-- "Parte" do processo deixa de ser só vendedor/comprador: passa a
-- aceitar corretor, imobiliária, administrador e cliente. Todos podem
-- ter link de autoatendimento (preencher os próprios dados e anexar
-- documentos). O checklist fixo de documentos continua só pra
-- vendedor/comprador; os outros papéis anexam documento avulso.
-- ================================================================

ALTER TABLE soma.processo_parte
  ALTER COLUMN tp_lado TYPE VARCHAR(20);

ALTER TABLE soma.processo_parte
  DROP CONSTRAINT IF EXISTS processo_parte_tp_lado_check;

ALTER TABLE soma.processo_parte
  ADD CONSTRAINT processo_parte_tp_lado_check CHECK (tp_lado IN (
    'vendedor', 'comprador', 'corretor', 'imobiliaria', 'adm', 'cliente'
  ));

-- ----------------------------------------------------------------
-- fn_parte_por_token — passa a devolver TODOS os documentos da parte
-- (categorizados e avulsos), pra tela pública listar.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_parte_por_token(p_token UUID)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
  SELECT jsonb_build_object(
    'cd_parte', pa.cd_parte,
    'cd_processo', pa.cd_processo,
    'tp_lado', pa.tp_lado,
    'nm_parte', pa.nm_parte,
    'ds_telefone', pa.ds_telefone,
    'ds_email', pa.ds_email,
    'ds_profissao', pa.ds_profissao,
    'ds_conta_bancaria', pa.ds_conta_bancaria,
    'ds_numero_processo', p.ds_numero_processo,
    'documentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'tp_categoria_intake', d.tp_categoria_intake,
        'nm_arquivo', d.nm_arquivo
      ) ORDER BY d.ts_criacao)
      FROM soma.documentos d
      WHERE d.cd_parte = pa.cd_parte
    ), '[]'::jsonb)
  )
  FROM soma.processo_parte pa
  JOIN soma.processos p ON p.cd_processo = pa.cd_processo
  WHERE pa.cd_token_parte = p_token;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_parte_por_token TO anon, authenticated;

-- ----------------------------------------------------------------
-- fn_registrar_documento_parte — aceita categoria do checklist (dedup
-- por parte+categoria) OU 'geral' pra documento avulso (sem dedup).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_registrar_documento_parte(
  p_token UUID,
  p_categoria VARCHAR,
  p_nm_arquivo VARCHAR,
  p_storage_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_parte soma.processo_parte%ROWTYPE;
  v_cd_documento UUID;
  v_perfil soma.type_perfil_documento;
  v_categoria VARCHAR;
BEGIN
  SELECT * INTO v_parte FROM soma.processo_parte WHERE cd_token_parte = p_token;
  IF v_parte.cd_parte IS NULL THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;

  v_categoria := NULLIF(p_categoria, 'geral');

  IF v_categoria IS NOT NULL
     AND v_categoria NOT IN ('identidade', 'estado_civil', 'comprovante_residencia', 'onus_escritura') THEN
    RAISE EXCEPTION 'Categoria de documento inválida.';
  END IF;

  v_perfil := CASE
    WHEN v_parte.tp_lado IN ('vendedor', 'comprador')
      THEN v_parte.tp_lado::soma.type_perfil_documento
    ELSE 'outro'
  END;

  -- Categoria do checklist: um documento por (parte, categoria).
  IF v_categoria IS NOT NULL THEN
    DELETE FROM soma.documentos
    WHERE cd_parte = v_parte.cd_parte AND tp_categoria_intake = v_categoria;
  END IF;

  INSERT INTO soma.documentos (
    cd_processo, tp_perfil_alvo, nm_tipo_documento, nm_arquivo, ds_storage_url,
    cd_parte, tp_categoria_intake
  )
  VALUES (
    v_parte.cd_processo, v_perfil,
    COALESCE(v_categoria, 'Documento enviado pela parte'),
    p_nm_arquivo, p_storage_url, v_parte.cd_parte, v_categoria
  )
  RETURNING cd_documento INTO v_cd_documento;

  RETURN v_cd_documento;
END;
$$;
