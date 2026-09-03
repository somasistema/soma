-- ================================================================
-- SOMA — Migration 050
-- Link público por parte (cada vendedor / comprador) pra preencher os
-- próprios dados e anexar os próprios documentos, sem login. Mesmo
-- esquema do /aceite/[token]: token na linha + RPCs SECURITY DEFINER
-- resolvendo tudo pelo token.
-- ================================================================

ALTER TABLE soma.processo_parte
  ADD COLUMN cd_token_parte UUID DEFAULT gen_random_uuid() UNIQUE;

-- ----------------------------------------------------------------
-- 1) fn_parte_por_token — dados da parte + nº do processo + docs já
--    anexados. NULL se o token não existe.
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
      ))
      FROM soma.documentos d
      WHERE d.cd_parte = pa.cd_parte AND d.tp_categoria_intake IS NOT NULL
    ), '[]'::jsonb)
  )
  FROM soma.processo_parte pa
  JOIN soma.processos p ON p.cd_processo = pa.cd_processo
  WHERE pa.cd_token_parte = p_token;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_parte_por_token TO anon, authenticated;

-- ----------------------------------------------------------------
-- 2) fn_atualizar_parte_publico — a própria parte edita seus dados.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_atualizar_parte_publico(p_token UUID, p_dados JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_parte UUID;
BEGIN
  SELECT cd_parte INTO v_cd_parte FROM soma.processo_parte WHERE cd_token_parte = p_token;
  IF v_cd_parte IS NULL THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;

  IF NULLIF(trim(p_dados->>'nm_parte'), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome.';
  END IF;

  UPDATE soma.processo_parte SET
    nm_parte = trim(p_dados->>'nm_parte'),
    ds_telefone = NULLIF(p_dados->>'ds_telefone', ''),
    ds_email = NULLIF(p_dados->>'ds_email', ''),
    ds_profissao = NULLIF(p_dados->>'ds_profissao', ''),
    ds_conta_bancaria = NULLIF(p_dados->>'ds_conta_bancaria', '')
  WHERE cd_parte = v_cd_parte;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_atualizar_parte_publico TO anon, authenticated;

-- ----------------------------------------------------------------
-- 3) fn_registrar_documento_parte — grava a linha em soma.documentos
--    depois que a aplicação subiu o arquivo (service_role) no bucket.
--    Um documento por (parte, categoria): reenviar substitui o antigo.
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
BEGIN
  SELECT * INTO v_parte FROM soma.processo_parte WHERE cd_token_parte = p_token;
  IF v_parte.cd_parte IS NULL THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;

  IF p_categoria NOT IN ('identidade', 'estado_civil', 'comprovante_residencia', 'onus_escritura') THEN
    RAISE EXCEPTION 'Categoria de documento inválida.';
  END IF;

  DELETE FROM soma.documentos
  WHERE cd_parte = v_parte.cd_parte AND tp_categoria_intake = p_categoria;

  INSERT INTO soma.documentos (
    cd_processo, tp_perfil_alvo, nm_tipo_documento, nm_arquivo, ds_storage_url,
    cd_parte, tp_categoria_intake
  )
  VALUES (
    v_parte.cd_processo, v_parte.tp_lado::soma.type_perfil_documento, p_categoria,
    p_nm_arquivo, p_storage_url, v_parte.cd_parte, p_categoria
  )
  RETURNING cd_documento INTO v_cd_documento;

  RETURN v_cd_documento;
END;
$$;
