-- ================================================================
-- SOMA — Migration 072
-- Pergunta "vive em união estável?" no link do cliente (/parte/[token]).
-- A resposta fica na parte (e no convite, quando o link foi gerado antes
-- do processo) e liga o item "Declaração de união estável" no checklist de
-- documentos dessa pessoa. null = não respondeu.
--
-- Reemite as funções do link (061) e as de salvar/atualizar dados (070).
-- A equipe editar o processo não apaga a resposta do cliente. Rodar
-- depois da 070.
-- ================================================================

ALTER TABLE soma.processo_parte ADD COLUMN IF NOT EXISTS sn_uniao_estavel BOOLEAN;
ALTER TABLE soma.convites_parte ADD COLUMN IF NOT EXISTS sn_uniao_estavel BOOLEAN;

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
    'sn_uniao_estavel', v_parte.sn_uniao_estavel,
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

REVOKE ALL ON FUNCTION soma.fn_parte_processo_por_token(UUID) FROM PUBLIC, anon, authenticated;

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
    'sn_uniao_estavel', c.sn_uniao_estavel,
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
      sn_uniao_estavel = NULLIF(p_dados->>'sn_uniao_estavel', '')::boolean,
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
    ds_endereco = NULLIF(trim(p_dados->>'ds_endereco'), ''),
    sn_uniao_estavel = NULLIF(p_dados->>'sn_uniao_estavel', '')::boolean
  WHERE cd_parte = v_cd_parte;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_atualizar_parte_publico TO anon, authenticated;

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
    sn_imovel_financiado, ds_prazo_financiamento,
    ds_imovel_endereco, ds_imovel_matricula, ds_imovel_iptu, ds_imovel_cartorio, ds_imovel_descricao,
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
    NULLIF(p_negocio->>'sn_imovel_financiado', '')::boolean,
    NULLIF(p_negocio->>'ds_prazo_financiamento', ''),
    NULLIF(p_negocio->>'ds_imovel_endereco', ''),
    NULLIF(p_negocio->>'ds_imovel_matricula', ''),
    NULLIF(p_negocio->>'ds_imovel_iptu', ''),
    NULLIF(p_negocio->>'ds_imovel_cartorio', ''),
    NULLIF(p_negocio->>'ds_imovel_descricao', ''),
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
    sn_imovel_financiado = EXCLUDED.sn_imovel_financiado,
    ds_prazo_financiamento = EXCLUDED.ds_prazo_financiamento,
    ds_imovel_endereco = EXCLUDED.ds_imovel_endereco,
    ds_imovel_matricula = EXCLUDED.ds_imovel_matricula,
    ds_imovel_iptu = EXCLUDED.ds_imovel_iptu,
    ds_imovel_cartorio = EXCLUDED.ds_imovel_cartorio,
    ds_imovel_descricao = EXCLUDED.ds_imovel_descricao,
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
    ds_cpf, ds_rg, dt_nascimento, ds_endereco, tp_vinculo, cd_token_parte,
    ds_nire, ds_tipo_societario, ds_representacao, sn_uniao_estavel
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
    COALESCE(NULLIF(parte->>'cd_token_parte', '')::uuid, gen_random_uuid()),
    NULLIF(trim(parte->>'ds_nire'), ''),
    NULLIF(trim(parte->>'ds_tipo_societario'), ''),
    NULLIF(parte->>'ds_representacao', ''),
    NULLIF(parte->>'sn_uniao_estavel', '')::boolean
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
    ds_endereco = COALESCE(NULLIF(trim(c.ds_endereco), ''), pa.ds_endereco),
    sn_uniao_estavel = COALESCE(c.sn_uniao_estavel, pa.sn_uniao_estavel)
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

CREATE OR REPLACE FUNCTION soma.fn_atualizar_dados_processo(
  p_cd_processo UUID,
  p_cd_imobiliaria UUID,
  p_nm_solicitante TEXT,
  p_ds_telefone TEXT,
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
  v_parte JSONB;
  v_cd_parte UUID;
  v_removida RECORD;
  v_docs INTEGER;
  v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico pode editar os dados do processo.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM soma.processos WHERE cd_processo = p_cd_processo) THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;

  p_negocio := COALESCE(p_negocio, '{}'::jsonb);

  INSERT INTO soma.processo_negocio (
    cd_processo, vl_imovel, vl_entrada, vl_financiamento, ds_banco,
    sn_possui_inquilino, sn_ocupado, ds_entrega_chaves, ds_itens_imovel,
    sn_imovel_financiado, ds_prazo_financiamento,
    ds_imovel_endereco, ds_imovel_matricula, ds_imovel_iptu, ds_imovel_cartorio, ds_imovel_descricao,
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
    NULLIF(p_negocio->>'sn_imovel_financiado', '')::boolean,
    NULLIF(p_negocio->>'ds_prazo_financiamento', ''),
    NULLIF(p_negocio->>'ds_imovel_endereco', ''),
    NULLIF(p_negocio->>'ds_imovel_matricula', ''),
    NULLIF(p_negocio->>'ds_imovel_iptu', ''),
    NULLIF(p_negocio->>'ds_imovel_cartorio', ''),
    NULLIF(p_negocio->>'ds_imovel_descricao', ''),
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
    sn_imovel_financiado = EXCLUDED.sn_imovel_financiado,
    ds_prazo_financiamento = EXCLUDED.ds_prazo_financiamento,
    ds_imovel_endereco = EXCLUDED.ds_imovel_endereco,
    ds_imovel_matricula = EXCLUDED.ds_imovel_matricula,
    ds_imovel_iptu = EXCLUDED.ds_imovel_iptu,
    ds_imovel_cartorio = EXCLUDED.ds_imovel_cartorio,
    ds_imovel_descricao = EXCLUDED.ds_imovel_descricao,
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

  -- Dados do processo em si (imobiliária é opcional).
  UPDATE soma.processos SET
    cd_imobiliaria = p_cd_imobiliaria,
    nm_comprador_convidado = NULLIF(trim(COALESCE(p_nm_solicitante, '')), ''),
    ds_telefone_comprador_convidado = NULLIF(trim(COALESCE(p_ds_telefone, '')), '')
  WHERE cd_processo = p_cd_processo;

  -- Partes: UPSERT por cd_parte. Não apaga e recria — os documentos
  -- (documentos.cd_parte) e o link do cliente (cd_token_parte) continuam
  -- ligados à mesma pessoa.
  FOR v_parte IN SELECT value FROM jsonb_array_elements(COALESCE(p_partes, '[]'::jsonb)) LOOP
    CONTINUE WHEN NULLIF(trim(v_parte->>'nm_parte'), '') IS NULL;
    CONTINUE WHEN v_parte->>'tp_lado' = 'corretor';

    v_cd_parte := NULLIF(v_parte->>'cd_parte', '')::uuid;
    IF v_cd_parte IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM soma.processo_parte WHERE cd_parte = v_cd_parte AND cd_processo = p_cd_processo
    ) THEN
      v_cd_parte := NULL;
    END IF;

    IF v_cd_parte IS NULL THEN
      INSERT INTO soma.processo_parte (
        cd_processo, tp_lado, nr_ordem, nm_parte, ds_telefone, ds_email,
        ds_profissao, ds_conta_bancaria, ds_documentos_obs,
        ds_cpf, ds_rg, dt_nascimento, ds_endereco, tp_vinculo, cd_token_parte,
        ds_nire, ds_tipo_societario, ds_representacao, sn_uniao_estavel
      )
      VALUES (
        p_cd_processo,
        v_parte->>'tp_lado',
        COALESCE((v_parte->>'nr_ordem')::int, 0),
        trim(v_parte->>'nm_parte'),
        NULLIF(v_parte->>'ds_telefone', ''),
        NULLIF(v_parte->>'ds_email', ''),
        NULLIF(v_parte->>'ds_profissao', ''),
        NULLIF(v_parte->>'ds_conta_bancaria', ''),
        NULLIF(v_parte->>'ds_documentos_obs', ''),
        NULLIF(trim(v_parte->>'ds_cpf'), ''),
        NULLIF(trim(v_parte->>'ds_rg'), ''),
        NULLIF(v_parte->>'dt_nascimento', '')::date,
        NULLIF(trim(v_parte->>'ds_endereco'), ''),
        NULLIF(v_parte->>'tp_vinculo', ''),
        gen_random_uuid(),
        NULLIF(trim(v_parte->>'ds_nire'), ''),
        NULLIF(trim(v_parte->>'ds_tipo_societario'), ''),
        NULLIF(v_parte->>'ds_representacao', ''),
        NULLIF(v_parte->>'sn_uniao_estavel', '')::boolean
      )
      RETURNING cd_parte INTO v_cd_parte;
    ELSE
      UPDATE soma.processo_parte SET
        tp_lado = v_parte->>'tp_lado',
        nr_ordem = COALESCE((v_parte->>'nr_ordem')::int, 0),
        nm_parte = trim(v_parte->>'nm_parte'),
        ds_telefone = NULLIF(v_parte->>'ds_telefone', ''),
        ds_email = NULLIF(v_parte->>'ds_email', ''),
        ds_profissao = NULLIF(v_parte->>'ds_profissao', ''),
        ds_conta_bancaria = NULLIF(v_parte->>'ds_conta_bancaria', ''),
        ds_documentos_obs = NULLIF(v_parte->>'ds_documentos_obs', ''),
        ds_cpf = NULLIF(trim(v_parte->>'ds_cpf'), ''),
        ds_rg = NULLIF(trim(v_parte->>'ds_rg'), ''),
        dt_nascimento = NULLIF(v_parte->>'dt_nascimento', '')::date,
        ds_endereco = NULLIF(trim(v_parte->>'ds_endereco'), ''),
        tp_vinculo = NULLIF(v_parte->>'tp_vinculo', ''),
        ds_nire = NULLIF(trim(v_parte->>'ds_nire'), ''),
        ds_tipo_societario = NULLIF(trim(v_parte->>'ds_tipo_societario'), ''),
        ds_representacao = NULLIF(v_parte->>'ds_representacao', ''),
        sn_uniao_estavel = COALESCE(NULLIF(v_parte->>'sn_uniao_estavel', '')::boolean, sn_uniao_estavel)
      WHERE cd_parte = v_cd_parte;
    END IF;

    v_ids := v_ids || v_cd_parte;
  END LOOP;

  -- Quem saiu da lista é removido — mas não se já tem documento anexado
  -- (o documento ficaria sem dono). Corretores (tp_lado = 'corretor')
  -- são tratados mais abaixo, junto dos honorários.
  FOR v_removida IN
    SELECT cd_parte, nm_parte FROM soma.processo_parte
    WHERE cd_processo = p_cd_processo
      AND tp_lado <> 'corretor'
      AND NOT (cd_parte = ANY (v_ids))
  LOOP
    SELECT count(*) INTO v_docs FROM soma.documentos WHERE cd_parte = v_removida.cd_parte;
    IF v_docs > 0 THEN
      RAISE EXCEPTION 'Não dá para remover % — há % documento(s) anexado(s) a essa pessoa.',
        v_removida.nm_parte, v_docs;
    END IF;
    DELETE FROM soma.processo_parte WHERE cd_parte = v_removida.cd_parte;
  END LOOP;

  -- Corretores que saíram dos honorários deixam de ser parte do processo.
  DELETE FROM soma.processo_parte
  WHERE cd_processo = p_cd_processo
    AND tp_lado = 'corretor'
    AND lower(trim(nm_parte)) NOT IN (
      SELECT lower(trim(c->>'nm_corretor'))
      FROM jsonb_array_elements(COALESCE(p_corretores, '[]'::jsonb)) c
      WHERE NULLIF(trim(c->>'nm_corretor'), '') IS NOT NULL
    );

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

  PERFORM soma.fn_registrar_andamento(
    p_cd_processo,
    'Dados do processo editados',
    'Partes, imóvel, valores ou honorários foram atualizados. Se já existe minuta, gere uma nova versão para refletir as mudanças.'
  );
END;
$$;

REVOKE ALL ON FUNCTION soma.fn_atualizar_dados_processo(UUID, UUID, TEXT, TEXT, JSONB, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soma.fn_atualizar_dados_processo(UUID, UUID, TEXT, TEXT, JSONB, JSONB, JSONB) TO authenticated;
