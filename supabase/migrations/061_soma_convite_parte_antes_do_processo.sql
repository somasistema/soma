-- ================================================================
-- SOMA — Migration 061
-- Link do cliente que funciona ANTES de o processo existir.
--
-- Ao gerar o link no cadastro do processo, o sistema grava um
-- "convite" (soma.convites_parte). O cliente abre o link, preenche os
-- dados e anexa documentos — tudo guardado no convite. Quando o
-- processo é criado com esse mesmo token, o convite vira a parte do
-- processo (dados mesclados, documentos movidos pelo app) e o MESMO
-- link continua valendo, agora ligado ao processo.
--
-- Escrita pelo time: fn_salvar_convite_parte (Master/Jurídico).
-- Escrita pelo cliente: as mesmas funções públicas de /parte/[token]
-- (fn_atualizar_parte_publico, fn_registrar_documento_parte,
-- fn_remover_documento_parte), que agora também entendem convite.
-- ================================================================

CREATE TABLE IF NOT EXISTS soma.convites_parte (
  -- é o próprio token do link
  cd_convite UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_criador UUID REFERENCES soma.usuarios(cd_usuario),
  tp_lado VARCHAR(20) NOT NULL CHECK (tp_lado IN ('vendedor', 'comprador')),
  nm_parte VARCHAR(255),
  ds_cpf VARCHAR(20),
  ds_rg VARCHAR(40),
  dt_nascimento DATE,
  ds_telefone VARCHAR(30),
  ds_email VARCHAR(255),
  ds_profissao VARCHAR(120),
  ds_conta_bancaria VARCHAR(255),
  ds_endereco TEXT,
  -- vira true quando o processo é criado com este token
  sn_consumido BOOLEAN NOT NULL DEFAULT false,
  cd_parte UUID REFERENCES soma.processo_parte(cd_parte) ON DELETE SET NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS soma.convite_documentos (
  cd_convite_documento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_convite UUID NOT NULL REFERENCES soma.convites_parte(cd_convite) ON DELETE CASCADE,
  tp_categoria_intake VARCHAR(30) NOT NULL CHECK (tp_categoria_intake IN (
    'identidade', 'estado_civil', 'comprovante_residencia', 'uniao_estavel'
  )),
  nm_arquivo VARCHAR(255) NOT NULL,
  ds_storage_url TEXT NOT NULL,
  -- resultado da leitura (o app grava; vira documento_ocr ao criar o processo)
  tp_documento_detectado VARCHAR(30),
  nr_confianca NUMERIC(5, 2),
  ds_campos JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- preenchido quando o arquivo é movido pro processo
  cd_documento UUID REFERENCES soma.documentos(cd_documento) ON DELETE SET NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_convite_documentos_convite
  ON soma.convite_documentos (cd_convite);

ALTER TABLE soma.convites_parte ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.convite_documentos ENABLE ROW LEVEL SECURITY;

-- Só o time interno lê; ninguém escreve direto (só pelas funções).
DROP POLICY IF EXISTS "convites_parte_select" ON soma.convites_parte;
CREATE POLICY "convites_parte_select" ON soma.convites_parte FOR SELECT
  USING (soma.fn_auth_role() IN ('master', 'juridico'));

DROP POLICY IF EXISTS "convite_documentos_select" ON soma.convite_documentos;
CREATE POLICY "convite_documentos_select" ON soma.convite_documentos FOR SELECT
  USING (soma.fn_auth_role() IN ('master', 'juridico'));

-- ----------------------------------------------------------------
-- 1) Time: cria/atualiza o convite (gera o link na hora)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_salvar_convite_parte(
  p_token UUID,
  p_tp_lado TEXT,
  p_dados JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_token UUID := p_token;
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico gera link para o cliente.';
  END IF;

  IF p_tp_lado NOT IN ('vendedor', 'comprador') THEN
    RAISE EXCEPTION 'Lado inválido.';
  END IF;

  IF v_token IS NULL THEN
    INSERT INTO soma.convites_parte (cd_criador, tp_lado, nm_parte, ds_cpf, ds_telefone, ds_email)
    VALUES (
      auth.uid(),
      p_tp_lado,
      NULLIF(trim(p_dados->>'nm_parte'), ''),
      NULLIF(trim(p_dados->>'ds_cpf'), ''),
      NULLIF(trim(p_dados->>'ds_telefone'), ''),
      NULLIF(trim(p_dados->>'ds_email'), '')
    )
    RETURNING cd_convite INTO v_token;
    RETURN v_token;
  END IF;

  -- Já gerado: o time só ajusta o que ainda não foi consumido, e nunca
  -- sobrescreve com vazio o que o cliente já preencheu.
  UPDATE soma.convites_parte SET
    nm_parte = COALESCE(NULLIF(trim(p_dados->>'nm_parte'), ''), nm_parte),
    ds_cpf = COALESCE(NULLIF(trim(p_dados->>'ds_cpf'), ''), ds_cpf),
    ds_telefone = COALESCE(NULLIF(trim(p_dados->>'ds_telefone'), ''), ds_telefone),
    ds_email = COALESCE(NULLIF(trim(p_dados->>'ds_email'), ''), ds_email),
    ts_atualizacao = now()
  WHERE cd_convite = v_token AND NOT sn_consumido;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link não encontrado ou já usado em um processo.';
  END IF;

  RETURN v_token;
END;
$$;

-- ----------------------------------------------------------------
-- 2) Público: /parte/[token] passa a achar o convite
--    (a lógica antiga de "parte do processo" vira fn_parte_processo_por_token)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_parte_processo_por_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_parte soma.processo_parte%ROWTYPE;
  v_numero TEXT;
  v_par RECORD;
  v_resultado JSONB;
BEGIN
  SELECT * INTO v_parte FROM soma.processo_parte WHERE cd_token_parte = p_token;
  IF v_parte.cd_parte IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT ds_numero_processo INTO v_numero FROM soma.processos WHERE cd_processo = v_parte.cd_processo;

  v_resultado := jsonb_build_object(
    'cd_parte', v_parte.cd_parte,
    'cd_processo', v_parte.cd_processo,
    'tp_lado', v_parte.tp_lado,
    'nm_parte', v_parte.nm_parte,
    'ds_telefone', v_parte.ds_telefone,
    'ds_email', v_parte.ds_email,
    'ds_profissao', v_parte.ds_profissao,
    'ds_conta_bancaria', v_parte.ds_conta_bancaria,
    'ds_cpf', v_parte.ds_cpf,
    'ds_rg', v_parte.ds_rg,
    'dt_nascimento', v_parte.dt_nascimento,
    'ds_endereco', v_parte.ds_endereco,
    'ds_numero_processo', v_numero,
    'documentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cd_documento', d.cd_documento,
        'tp_categoria_intake', d.tp_categoria_intake,
        'nm_arquivo', d.nm_arquivo
      ) ORDER BY d.ts_criacao)
      FROM soma.documentos d
      WHERE d.cd_parte = v_parte.cd_parte
        AND COALESCE(d.tp_categoria_intake, '') NOT IN ('iptu', 'onus_escritura')
    ), '[]'::jsonb),
    'parceiro', NULL,
    'documentos_imovel', NULL
  );

  SELECT * INTO v_par FROM soma.fn_par_da_parte(v_parte.cd_parte);
  IF v_par.cd_parte IS NOT NULL THEN
    v_resultado := v_resultado || jsonb_build_object('parceiro', jsonb_build_object(
      'nm_parte', v_par.nm_parte,
      'tp_vinculo', v_par.tp_vinculo,
      'documentos', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'tp_categoria_intake', d.tp_categoria_intake,
          'nm_arquivo', d.nm_arquivo
        ) ORDER BY d.ts_criacao)
        FROM soma.documentos d
        WHERE d.cd_parte = v_par.cd_parte AND d.tp_categoria_intake IS NOT NULL
      ), '[]'::jsonb)
    ));
  END IF;

  -- Vendedor também vê (e pode mandar) os documentos do imóvel — um
  -- conjunto só por processo, não um por vendedor.
  IF v_parte.tp_lado = 'vendedor' THEN
    v_resultado := v_resultado || jsonb_build_object('documentos_imovel', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cd_documento', d.cd_documento,
        'tp_categoria_intake', d.tp_categoria_intake,
        'nm_arquivo', d.nm_arquivo,
        'sn_meu', d.cd_parte = v_parte.cd_parte
      ) ORDER BY d.ts_criacao)
      FROM soma.documentos d
      WHERE d.cd_processo = v_parte.cd_processo
        AND d.tp_categoria_intake IN ('iptu', 'onus_escritura')
    ), '[]'::jsonb));
  END IF;

  RETURN v_resultado;
END;
$$;

-- Só as funções do próprio banco chamam esta; o público usa fn_parte_por_token.
REVOKE ALL ON FUNCTION soma.fn_parte_processo_por_token(UUID) FROM PUBLIC, anon, authenticated;


-- Público: a mesma resposta da parte do processo, mas vinda do convite.
CREATE OR REPLACE FUNCTION soma.fn_parte_por_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v JSONB;
  c soma.convites_parte%ROWTYPE;
BEGIN
  v := soma.fn_parte_processo_por_token(p_token);
  IF v IS NOT NULL THEN
    RETURN v;
  END IF;

  SELECT * INTO c FROM soma.convites_parte WHERE cd_convite = p_token AND NOT sn_consumido;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'cd_parte', NULL,
    'cd_processo', NULL,
    'tp_lado', c.tp_lado,
    'nm_parte', c.nm_parte,
    'ds_telefone', c.ds_telefone,
    'ds_email', c.ds_email,
    'ds_profissao', c.ds_profissao,
    'ds_conta_bancaria', c.ds_conta_bancaria,
    'ds_cpf', c.ds_cpf,
    'ds_rg', c.ds_rg,
    'dt_nascimento', c.dt_nascimento,
    'ds_endereco', c.ds_endereco,
    'ds_numero_processo', NULL,
    'documentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'cd_documento', d.cd_convite_documento,
        'tp_categoria_intake', d.tp_categoria_intake,
        'nm_arquivo', d.nm_arquivo
      ) ORDER BY d.ts_criacao)
      FROM soma.convite_documentos d
      WHERE d.cd_convite = c.cd_convite
    ), '[]'::jsonb),
    'parceiro', NULL,
    'documentos_imovel', NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_parte_por_token TO anon, authenticated;

-- Público: o cliente salva os próprios dados (parte do processo OU convite).
CREATE OR REPLACE FUNCTION soma.fn_atualizar_parte_publico(p_token UUID, p_dados JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_parte UUID;
BEGIN
  SELECT cd_parte INTO v_cd_parte FROM soma.processo_parte WHERE cd_token_parte = p_token;

  IF v_cd_parte IS NULL AND NOT EXISTS (
    SELECT 1 FROM soma.convites_parte WHERE cd_convite = p_token AND NOT sn_consumido
  ) THEN
    RAISE EXCEPTION 'Link inválido.';
  END IF;

  IF NULLIF(trim(p_dados->>'nm_parte'), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o nome.';
  END IF;

  IF v_cd_parte IS NULL THEN
    UPDATE soma.convites_parte SET
      nm_parte = trim(p_dados->>'nm_parte'),
      ds_telefone = NULLIF(p_dados->>'ds_telefone', ''),
      ds_email = NULLIF(p_dados->>'ds_email', ''),
      ds_profissao = NULLIF(p_dados->>'ds_profissao', ''),
      ds_conta_bancaria = NULLIF(p_dados->>'ds_conta_bancaria', ''),
      ds_cpf = NULLIF(trim(p_dados->>'ds_cpf'), ''),
      ds_rg = NULLIF(trim(p_dados->>'ds_rg'), ''),
      dt_nascimento = NULLIF(p_dados->>'dt_nascimento', '')::date,
      ds_endereco = NULLIF(trim(p_dados->>'ds_endereco'), ''),
      ts_atualizacao = now()
    WHERE cd_convite = p_token AND NOT sn_consumido;
    RETURN;
  END IF;

  UPDATE soma.processo_parte SET
    nm_parte = trim(p_dados->>'nm_parte'),
    ds_telefone = NULLIF(p_dados->>'ds_telefone', ''),
    ds_email = NULLIF(p_dados->>'ds_email', ''),
    ds_profissao = NULLIF(p_dados->>'ds_profissao', ''),
    ds_conta_bancaria = NULLIF(p_dados->>'ds_conta_bancaria', ''),
    ds_cpf = NULLIF(trim(p_dados->>'ds_cpf'), ''),
    ds_rg = NULLIF(trim(p_dados->>'ds_rg'), ''),
    dt_nascimento = NULLIF(p_dados->>'dt_nascimento', '')::date,
    ds_endereco = NULLIF(trim(p_dados->>'ds_endereco'), '')
  WHERE cd_parte = v_cd_parte;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_atualizar_parte_publico TO anon, authenticated;

-- Público: registra o documento enviado (parte do processo OU convite).
-- Devolve o id do documento (ou do documento do convite).
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

  v_categoria := NULLIF(p_categoria, 'geral');

  IF v_categoria IS NOT NULL AND v_categoria NOT IN (
    'identidade', 'estado_civil', 'comprovante_residencia', 'onus_escritura', 'iptu', 'uniao_estavel'
  ) THEN
    RAISE EXCEPTION 'Categoria de documento inválida.';
  END IF;

  -- Ainda é convite (processo não criado)
  IF v_parte.cd_parte IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM soma.convites_parte WHERE cd_convite = p_token AND NOT sn_consumido
    ) THEN
      RAISE EXCEPTION 'Link inválido.';
    END IF;
    IF v_categoria IS NULL OR v_categoria IN ('iptu', 'onus_escritura') THEN
      RAISE EXCEPTION 'Esse documento pode ser enviado depois que o processo for criado.';
    END IF;

    INSERT INTO soma.convite_documentos (cd_convite, tp_categoria_intake, nm_arquivo, ds_storage_url)
    VALUES (p_token, v_categoria, p_nm_arquivo, p_storage_url)
    RETURNING cd_convite_documento INTO v_cd_documento;

    RETURN v_cd_documento;
  END IF;

  IF v_categoria IN ('iptu', 'onus_escritura') AND v_parte.tp_lado <> 'vendedor' THEN
    RAISE EXCEPTION 'Documentos do imóvel são enviados pelo vendedor.';
  END IF;

  v_perfil := CASE
    WHEN v_categoria IN ('iptu', 'onus_escritura') THEN 'imovel'
    WHEN v_parte.tp_lado IN ('vendedor', 'comprador') THEN v_parte.tp_lado::soma.type_perfil_documento
    ELSE 'outro'
  END;

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

-- Público: o cliente remove um arquivo que ele mesmo mandou.
CREATE OR REPLACE FUNCTION soma.fn_remover_documento_parte(
  p_token UUID,
  p_cd_documento UUID
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_parte UUID;
  v_storage TEXT;
BEGIN
  SELECT cd_parte INTO v_cd_parte FROM soma.processo_parte WHERE cd_token_parte = p_token;

  IF v_cd_parte IS NULL THEN
    DELETE FROM soma.convite_documentos d
    USING soma.convites_parte c
    WHERE d.cd_convite_documento = p_cd_documento
      AND d.cd_convite = p_token
      AND c.cd_convite = d.cd_convite
      AND NOT c.sn_consumido
    RETURNING d.ds_storage_url INTO v_storage;

    IF v_storage IS NULL THEN
      RAISE EXCEPTION 'Documento não encontrado.';
    END IF;
    RETURN v_storage;
  END IF;

  DELETE FROM soma.documentos
  WHERE cd_documento = p_cd_documento AND cd_parte = v_cd_parte
  RETURNING ds_storage_url INTO v_storage;

  IF v_storage IS NULL THEN
    RAISE EXCEPTION 'Documento não encontrado.';
  END IF;

  RETURN v_storage;
END;
$$;

-- ----------------------------------------------------------------
-- 3) Criação do processo: o convite vira a parte
--    (fn_salvar_dados_negocio = a da 060 + a mesclagem do convite)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_salvar_dados_negocio(
  p_cd_processo UUID,
  p_negocio JSONB,
  p_partes JSONB,
  p_corretores JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_corretor JSONB;
  v_ordem BIGINT;
  v_cd_corretor UUID;
  v_nome TEXT;
  v_cad soma.corretores%ROWTYPE;
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico pode editar os dados do negócio.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM soma.processos WHERE cd_processo = p_cd_processo) THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;

  p_negocio := COALESCE(p_negocio, '{}'::jsonb);

  INSERT INTO soma.processo_negocio (
    cd_processo, vl_imovel, vl_entrada, vl_financiamento, ds_banco,
    sn_possui_inquilino, sn_ocupado, ds_entrega_chaves, ds_itens_imovel,
    ds_imovel_endereco, ds_imovel_matricula, ds_imovel_iptu, ds_imovel_cartorio,
    tp_pagamento, vl_sinal, sn_usa_fgts, vl_fgts, vl_saldo_quitacao,
    vl_honorarios_total, pc_honorarios_total, ds_honorarios_quando,
    vl_honorarios_imobiliaria, pc_honorarios_imobiliaria
  )
  VALUES (
    p_cd_processo,
    NULLIF(p_negocio->>'vl_imovel', '')::numeric,
    NULLIF(p_negocio->>'vl_entrada', '')::numeric,
    NULLIF(p_negocio->>'vl_financiamento', '')::numeric,
    NULLIF(p_negocio->>'ds_banco', ''),
    NULLIF(p_negocio->>'sn_possui_inquilino', '')::boolean,
    NULLIF(p_negocio->>'sn_ocupado', '')::boolean,
    NULLIF(p_negocio->>'ds_entrega_chaves', ''),
    NULLIF(p_negocio->>'ds_itens_imovel', ''),
    NULLIF(p_negocio->>'ds_imovel_endereco', ''),
    NULLIF(p_negocio->>'ds_imovel_matricula', ''),
    NULLIF(p_negocio->>'ds_imovel_iptu', ''),
    NULLIF(p_negocio->>'ds_imovel_cartorio', ''),
    NULLIF(p_negocio->>'tp_pagamento', ''),
    NULLIF(p_negocio->>'vl_sinal', '')::numeric,
    NULLIF(p_negocio->>'sn_usa_fgts', '')::boolean,
    NULLIF(p_negocio->>'vl_fgts', '')::numeric,
    NULLIF(p_negocio->>'vl_saldo_quitacao', '')::numeric,
    NULLIF(p_negocio->>'vl_honorarios_total', '')::numeric,
    NULLIF(p_negocio->>'pc_honorarios_total', '')::numeric,
    NULLIF(p_negocio->>'ds_honorarios_quando', ''),
    NULLIF(p_negocio->>'vl_honorarios_imobiliaria', '')::numeric,
    NULLIF(p_negocio->>'pc_honorarios_imobiliaria', '')::numeric
  )
  ON CONFLICT (cd_processo) DO UPDATE SET
    vl_imovel = EXCLUDED.vl_imovel,
    vl_entrada = EXCLUDED.vl_entrada,
    vl_financiamento = EXCLUDED.vl_financiamento,
    ds_banco = EXCLUDED.ds_banco,
    sn_possui_inquilino = EXCLUDED.sn_possui_inquilino,
    sn_ocupado = EXCLUDED.sn_ocupado,
    ds_entrega_chaves = EXCLUDED.ds_entrega_chaves,
    ds_itens_imovel = EXCLUDED.ds_itens_imovel,
    ds_imovel_endereco = EXCLUDED.ds_imovel_endereco,
    ds_imovel_matricula = EXCLUDED.ds_imovel_matricula,
    ds_imovel_iptu = EXCLUDED.ds_imovel_iptu,
    ds_imovel_cartorio = EXCLUDED.ds_imovel_cartorio,
    tp_pagamento = EXCLUDED.tp_pagamento,
    vl_sinal = EXCLUDED.vl_sinal,
    sn_usa_fgts = EXCLUDED.sn_usa_fgts,
    vl_fgts = EXCLUDED.vl_fgts,
    vl_saldo_quitacao = EXCLUDED.vl_saldo_quitacao,
    vl_honorarios_total = EXCLUDED.vl_honorarios_total,
    pc_honorarios_total = EXCLUDED.pc_honorarios_total,
    ds_honorarios_quando = EXCLUDED.ds_honorarios_quando,
    vl_honorarios_imobiliaria = EXCLUDED.vl_honorarios_imobiliaria,
    pc_honorarios_imobiliaria = EXCLUDED.pc_honorarios_imobiliaria,
    ts_atualizacao = now();

  DELETE FROM soma.processo_parte WHERE cd_processo = p_cd_processo;
  INSERT INTO soma.processo_parte (
    cd_processo, tp_lado, nr_ordem, nm_parte, ds_telefone, ds_email,
    ds_profissao, ds_conta_bancaria, ds_documentos_obs,
    ds_cpf, ds_rg, dt_nascimento, ds_endereco, tp_vinculo, cd_token_parte
  )
  SELECT
    p_cd_processo,
    parte->>'tp_lado',
    COALESCE((parte->>'nr_ordem')::int, 0),
    trim(parte->>'nm_parte'),
    NULLIF(parte->>'ds_telefone', ''),
    NULLIF(parte->>'ds_email', ''),
    NULLIF(parte->>'ds_profissao', ''),
    NULLIF(parte->>'ds_conta_bancaria', ''),
    NULLIF(parte->>'ds_documentos_obs', ''),
    NULLIF(trim(parte->>'ds_cpf'), ''),
    NULLIF(trim(parte->>'ds_rg'), ''),
    NULLIF(parte->>'dt_nascimento', '')::date,
    NULLIF(trim(parte->>'ds_endereco'), ''),
    NULLIF(parte->>'tp_vinculo', ''),
    COALESCE(NULLIF(parte->>'cd_token_parte', '')::uuid, gen_random_uuid())
  FROM jsonb_array_elements(COALESCE(p_partes, '[]'::jsonb)) AS parte
  WHERE NULLIF(trim(parte->>'nm_parte'), '') IS NOT NULL;

  -- Convite (link gerado antes do processo): o que o cliente preencheu
  -- passa pra parte — o dado do convite é o mais recente, então vale
  -- sobre o que veio da tela. O documento é movido pelo app.
  UPDATE soma.processo_parte pa SET
    nm_parte = COALESCE(NULLIF(trim(c.nm_parte), ''), pa.nm_parte),
    ds_cpf = COALESCE(NULLIF(trim(c.ds_cpf), ''), pa.ds_cpf),
    ds_rg = COALESCE(NULLIF(trim(c.ds_rg), ''), pa.ds_rg),
    dt_nascimento = COALESCE(c.dt_nascimento, pa.dt_nascimento),
    ds_telefone = COALESCE(NULLIF(trim(c.ds_telefone), ''), pa.ds_telefone),
    ds_email = COALESCE(NULLIF(trim(c.ds_email), ''), pa.ds_email),
    ds_profissao = COALESCE(NULLIF(trim(c.ds_profissao), ''), pa.ds_profissao),
    ds_conta_bancaria = COALESCE(NULLIF(trim(c.ds_conta_bancaria), ''), pa.ds_conta_bancaria),
    ds_endereco = COALESCE(NULLIF(trim(c.ds_endereco), ''), pa.ds_endereco)
  FROM soma.convites_parte c
  WHERE pa.cd_processo = p_cd_processo
    AND pa.cd_token_parte = c.cd_convite
    AND NOT c.sn_consumido;

  UPDATE soma.convites_parte c SET
    sn_consumido = true,
    cd_parte = pa.cd_parte,
    ts_atualizacao = now()
  FROM soma.processo_parte pa
  WHERE pa.cd_processo = p_cd_processo
    AND pa.cd_token_parte = c.cd_convite
    AND NOT c.sn_consumido;

  DELETE FROM soma.processo_corretor WHERE cd_processo = p_cd_processo;

  FOR v_corretor, v_ordem IN
    SELECT value, ordinality
    FROM jsonb_array_elements(COALESCE(p_corretores, '[]'::jsonb)) WITH ORDINALITY
  LOOP
    v_nome := NULLIF(trim(v_corretor->>'nm_corretor'), '');
    CONTINUE WHEN v_nome IS NULL;

    v_cd_corretor := NULLIF(v_corretor->>'cd_corretor', '')::uuid;
    IF v_cd_corretor IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM soma.corretores WHERE cd_corretor = v_cd_corretor) THEN
      v_cd_corretor := NULL;
    END IF;
    IF v_cd_corretor IS NULL THEN
      SELECT cd_corretor INTO v_cd_corretor
      FROM soma.corretores
      WHERE lower(trim(nm_corretor)) = lower(v_nome)
      ORDER BY sn_ativo DESC, ts_criacao
      LIMIT 1;
    END IF;

    IF v_cd_corretor IS NULL THEN
      INSERT INTO soma.corretores (
        nm_corretor, ds_cpf, ds_creci, ds_telefone, ds_email, ds_pix, dt_nascimento
      )
      VALUES (
        v_nome,
        NULLIF(trim(v_corretor->>'ds_cpf'), ''),
        NULLIF(trim(v_corretor->>'ds_creci'), ''),
        NULLIF(trim(v_corretor->>'ds_telefone'), ''),
        NULLIF(trim(v_corretor->>'ds_email'), ''),
        NULLIF(trim(v_corretor->>'ds_pix'), ''),
        NULLIF(v_corretor->>'dt_nascimento', '')::date
      )
      RETURNING cd_corretor INTO v_cd_corretor;
    ELSE
      UPDATE soma.corretores SET
        ds_cpf = COALESCE(ds_cpf, NULLIF(trim(v_corretor->>'ds_cpf'), '')),
        ds_creci = COALESCE(ds_creci, NULLIF(trim(v_corretor->>'ds_creci'), '')),
        ds_telefone = COALESCE(ds_telefone, NULLIF(trim(v_corretor->>'ds_telefone'), '')),
        ds_email = COALESCE(ds_email, NULLIF(trim(v_corretor->>'ds_email'), '')),
        ds_pix = COALESCE(ds_pix, NULLIF(trim(v_corretor->>'ds_pix'), '')),
        dt_nascimento = COALESCE(dt_nascimento, NULLIF(v_corretor->>'dt_nascimento', '')::date)
      WHERE cd_corretor = v_cd_corretor;
    END IF;

    SELECT * INTO v_cad FROM soma.corretores WHERE cd_corretor = v_cd_corretor;

    INSERT INTO soma.processo_corretor (
      cd_processo, nm_corretor, vl_honorario, pc_honorario, ds_lado, cd_corretor, nr_ordem
    )
    VALUES (
      p_cd_processo,
      v_nome,
      NULLIF(v_corretor->>'vl_honorario', '')::numeric,
      NULLIF(v_corretor->>'pc_honorario', '')::numeric,
      NULLIF(v_corretor->>'ds_lado', ''),
      v_cd_corretor,
      v_ordem::int
    );

    IF NOT EXISTS (
      SELECT 1 FROM soma.processo_parte
      WHERE cd_processo = p_cd_processo
        AND tp_lado = 'corretor'
        AND lower(trim(nm_parte)) = lower(v_nome)
    ) THEN
      INSERT INTO soma.processo_parte (
        cd_processo, tp_lado, nr_ordem, nm_parte, ds_telefone, ds_email, ds_cpf, dt_nascimento
      )
      VALUES (
        p_cd_processo, 'corretor', v_ordem::int, v_nome, v_cad.ds_telefone, v_cad.ds_email,
        v_cad.ds_cpf, v_cad.dt_nascimento
      );
    END IF;
  END LOOP;
END;
$$;
