-- ================================================================
-- SOMA — Migration 070
-- Ajustes pedidos pela cliente ao ler a minuta enviada por e-mail:
--
--   * cláusula terceira com as alíneas a), b), c);
--   * "EXCETO FINANCIAMENTO" (cláusula quarta) só fica se o imóvel tem
--     financiamento/hipoteca em aberto — a IA lê isso da matrícula
--     (sn_imovel_financiado) e o texto sai em vermelho pra conferência;
--   * prazo de entrega das chaves (cláusula sexta) usa o campo "Entrega
--     das chaves" do processo (antes o modelo tinha 00 (XXXX) fixo);
--   * prazo de assinatura do financiamento (3.2) vira campo do processo
--     (padrão "60 (sessenta) dias corridos") e sai em vermelho;
--   * linhas de assinatura: uma por pessoa (antes sempre duas pro vendedor).
--
-- Reemite fn_render_modelo_contrato (063), fn_salvar_dados_negocio (063) e
-- fn_atualizar_dados_processo (065) com os dois campos novos. Rodar depois
-- da 065.
-- ================================================================

ALTER TABLE soma.processo_negocio
  ADD COLUMN IF NOT EXISTS sn_imovel_financiado BOOLEAN,       -- null = ainda não se sabe
  ADD COLUMN IF NOT EXISTS ds_prazo_financiamento TEXT;        -- null = padrão (60 dias)

CREATE OR REPLACE FUNCTION soma.fn_render_modelo_contrato(
  p_cd_processo UUID,
  p_cd_modelo UUID,
  p_marcar BOOLEAN DEFAULT false
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_processo soma.processos%ROWTYPE;
  v_negocio soma.processo_negocio%ROWTYPE;
  v_imobiliaria soma.imobiliarias%ROWTYPE;
  v_conteudo TEXT;
  v_campos JSONB := '{}'::jsonb;
  v_chave TEXT;
  v_valor TEXT;
  v_lado TEXT;
  v_p TEXT;
  v_i INTEGER;
  v_nomes TEXT[];
  v_fallback TEXT;
  v_vinculo TEXT;
  v_rep TEXT[];
  v_rep_nomes TEXT[];
  v_anu TEXT[];
  v_anu_nomes TEXT[];
  v_repr TEXT;
  v_mes TEXT;
  v_cart_numero TEXT;
  v_cart_cidade TEXT;
  v_destino TEXT;
  v_distribuicao TEXT[] := ARRAY[]::TEXT[];
  v_letra INTEGER := 0;
  v_vazio CONSTANT TEXT := '__________';
  v_ini TEXT := CASE WHEN p_marcar THEN chr(2) ELSE '' END;
  v_fim TEXT := CASE WHEN p_marcar THEN chr(3) ELSE '' END;
  r RECORD;
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico pode gerar minuta.';
  END IF;

  SELECT * INTO v_processo FROM soma.processos WHERE cd_processo = p_cd_processo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;
  IF v_processo.tp_processo <> 'contrato' THEN
    RAISE EXCEPTION 'Só processos de contrato geram minuta a partir de modelo.';
  END IF;

  SELECT ds_conteudo INTO v_conteudo
  FROM soma.modelos_contrato WHERE cd_modelo = p_cd_modelo AND sn_ativo;
  IF v_conteudo IS NULL THEN
    RAISE EXCEPTION 'Modelo não encontrado ou inativo.';
  END IF;

  SELECT * INTO v_negocio FROM soma.processo_negocio WHERE cd_processo = p_cd_processo;
  SELECT * INTO v_imobiliaria FROM soma.imobiliarias WHERE cd_imobiliaria = v_processo.cd_imobiliaria;

  -- Geral --------------------------------------------------------
  v_mes := CASE extract(month FROM current_date)::int
    WHEN 1 THEN 'janeiro'   WHEN 2 THEN 'fevereiro' WHEN 3 THEN 'março'
    WHEN 4 THEN 'abril'     WHEN 5 THEN 'maio'      WHEN 6 THEN 'junho'
    WHEN 7 THEN 'julho'     WHEN 8 THEN 'agosto'    WHEN 9 THEN 'setembro'
    WHEN 10 THEN 'outubro'  WHEN 11 THEN 'novembro' WHEN 12 THEN 'dezembro'
  END;

  v_campos := v_campos || jsonb_build_object(
    'numero_processo', v_processo.ds_numero_processo,
    'data_hoje', to_char(current_date, 'DD/MM/YYYY'),
    'data_extenso', extract(day FROM current_date)::int || ' de ' || v_mes
      || ' de ' || extract(year FROM current_date)::int,
    'imobiliaria', v_imobiliaria.nm_imobiliaria,
    'imobiliaria_cnpj', v_imobiliaria.ds_cnpj,
    'imobiliaria_creci', v_imobiliaria.ds_creci,
    'imobiliaria_endereco', v_imobiliaria.ds_endereco
  );

  -- Vendedores e compradores -------------------------------------
  FOREACH v_lado IN ARRAY ARRAY['vendedor', 'comprador'] LOOP
    v_i := 0;
    v_nomes := ARRAY[]::TEXT[];
    FOR r IN
      SELECT * FROM soma.processo_parte
      WHERE cd_processo = p_cd_processo AND tp_lado = v_lado
      ORDER BY nr_ordem, nm_parte
    LOOP
      v_i := v_i + 1;
      v_p := v_lado || '_' || v_i;
      v_nomes := v_nomes || r.nm_parte;
      v_campos := v_campos || jsonb_build_object(
        v_p, r.nm_parte,
        v_p || '_profissao', r.ds_profissao,
        v_p || '_telefone', r.ds_telefone,
        v_p || '_email', r.ds_email,
        v_p || '_conta', r.ds_conta_bancaria,
        v_p || '_endereco', r.ds_endereco,
        -- digitado na tela primeiro; senão, o que a leitura dos documentos achou
        v_p || '_cpf', COALESCE(NULLIF(trim(r.ds_cpf), ''), soma.fn_campo_ocr_da_parte(r.cd_parte, 'cpf')),
        v_p || '_rg', COALESCE(NULLIF(trim(r.ds_rg), ''), soma.fn_campo_ocr_da_parte(r.cd_parte, 'rg')),
        v_p || '_nascimento', COALESCE(
          to_char(r.dt_nascimento, 'DD/MM/YYYY'),
          soma.fn_campo_ocr_da_parte(r.cd_parte, 'data_nascimento')
        )
      );

      -- Dados que só existem nos documentos (naturalidade, filiação,
      -- regime de bens).
      v_campos := v_campos || jsonb_build_object(
        v_p || '_naturalidade', soma.fn_campo_ocr_da_parte(r.cd_parte, 'naturalidade'),
        v_p || '_nome_pai', soma.fn_campo_ocr_da_parte(r.cd_parte, 'nome_pai'),
        v_p || '_nome_mae', soma.fn_campo_ocr_da_parte(r.cd_parte, 'nome_mae'),
        v_p || '_filiacao', soma.fn_juntar_nomes(array_remove(ARRAY[
          soma.fn_campo_ocr_da_parte(r.cd_parte, 'nome_pai'),
          soma.fn_campo_ocr_da_parte(r.cd_parte, 'nome_mae')
        ], NULL)),
        v_p || '_regime_bens', soma.fn_campo_ocr_do_casal(r.cd_parte, 'regime_bens'),
        v_p || '_estado_civil', soma.fn_campo_ocr_do_casal(r.cd_parte, 'estado_civil')
      );

      -- Pessoa jurídica: o CNPJ mora no mesmo campo do CPF; 14 dígitos = empresa.
      v_campos := v_campos || jsonb_build_object(
        v_p || '_pj', CASE WHEN length(regexp_replace(COALESCE(r.ds_cpf, ''), '\D', '', 'g')) = 14 THEN 'sim' END,
        v_p || '_documento_tipo', CASE WHEN length(regexp_replace(COALESCE(r.ds_cpf, ''), '\D', '', 'g')) = 14 THEN 'CNPJ' ELSE 'CPF' END,
        v_p || '_nire', r.ds_nire,
        v_p || '_tipo_societario', r.ds_tipo_societario
      );

      -- Vínculo com a pessoa anterior (2ª em diante). Sem vínculo
      -- informado = cônjuge (como a tela rotulava antes).
      IF v_i >= 2 THEN
        v_vinculo := COALESCE(r.tp_vinculo, 'conjuge');
        v_campos := v_campos || jsonb_build_object(
          v_p || '_vinculo', CASE v_vinculo
            WHEN 'conjuge' THEN 'cônjuge'
            WHEN 'companheiro' THEN 'companheiro(a)'
            WHEN 'anuente' THEN 'anuente'
            ELSE 'outra pessoa'
          END,
          v_p || '_conjuge', CASE WHEN v_vinculo = 'conjuge' THEN 'sim' END,
          v_p || '_companheiro', CASE WHEN v_vinculo = 'companheiro' THEN 'sim' END,
          v_p || '_anuente', CASE WHEN v_vinculo = 'anuente' THEN 'sim' END,
          v_p || '_outro', CASE WHEN v_vinculo = 'outro' THEN 'sim' END
        );
      END IF;
    END LOOP;

    -- Representantes (sócios-administradores) e anuentes (demais sócios) da
    -- empresa: cada um qualificado por inteiro, e só os nomes pra assinatura.
    v_rep := ARRAY[]::TEXT[]; v_rep_nomes := ARRAY[]::TEXT[];
    v_anu := ARRAY[]::TEXT[]; v_anu_nomes := ARRAY[]::TEXT[];
    FOR r IN
      SELECT * FROM soma.processo_parte
      WHERE cd_processo = p_cd_processo AND tp_lado = v_lado
        AND tp_vinculo IN ('representante', 'anuente')
      ORDER BY nr_ordem, nm_parte
    LOOP
      IF r.tp_vinculo = 'representante' THEN
        v_rep := v_rep || soma.fn_qualificar_pessoa(r.cd_parte);
        v_rep_nomes := v_rep_nomes || upper(r.nm_parte);
      ELSE
        v_anu := v_anu || soma.fn_qualificar_pessoa(r.cd_parte);
        v_anu_nomes := v_anu_nomes || upper(r.nm_parte);
      END IF;
    END LOOP;

    SELECT CASE ds_representacao WHEN 'isolada' THEN 'isoladamente' ELSE 'em conjunto' END INTO v_repr
    FROM soma.processo_parte
    WHERE cd_processo = p_cd_processo AND tp_lado = v_lado
    ORDER BY nr_ordem, nm_parte
    LIMIT 1;

    v_campos := v_campos || jsonb_build_object(
      v_lado || '_representantes', soma.fn_juntar_qualificacoes(v_rep),
      v_lado || '_representantes_nomes', soma.fn_juntar_nomes(v_rep_nomes),
      v_lado || '_anuentes', soma.fn_juntar_qualificacoes(v_anu),
      v_lado || '_anuentes_nomes', soma.fn_juntar_nomes(v_anu_nomes),
      v_lado || '_representacao', COALESCE(v_repr, 'em conjunto')
    );

    v_fallback := NULL;
    IF cardinality(v_nomes) = 0 THEN
      SELECT nm_usuario INTO v_fallback FROM soma.usuarios
      WHERE cd_usuario = CASE WHEN v_lado = 'vendedor' THEN v_processo.cd_vendedor ELSE v_processo.cd_comprador END;
    END IF;

    v_campos := v_campos || jsonb_build_object(
      v_lado, COALESCE(soma.fn_juntar_nomes(v_nomes), v_fallback)
    );
  END LOOP;

  -- Imóvel e pagamento -------------------------------------------
  SELECT numero, cidade INTO v_cart_numero, v_cart_cidade
  FROM soma.fn_cartorio_partes(v_negocio.ds_imovel_cartorio);

  v_campos := v_campos || jsonb_build_object(
    'imovel_descricao', v_negocio.ds_imovel_descricao,
    'imovel_endereco', v_negocio.ds_imovel_endereco,
    'imovel_matricula', v_negocio.ds_imovel_matricula,
    'imovel_iptu', v_negocio.ds_imovel_iptu,
    'imovel_cartorio', CASE WHEN v_cart_numero IS NOT NULL
      THEN v_cart_numero || ' Ofício de Registro de Imóveis de ' || v_cart_cidade || '/BA' END,
    'imovel_cartorio_numero', v_cart_numero,
    'imovel_cartorio_cidade', v_cart_cidade,
    'imovel_valor', soma.fn_formatar_moeda(v_negocio.vl_imovel),
    'imovel_valor_extenso', soma.fn_valor_extenso(v_negocio.vl_imovel),
    'imovel_forma_pagamento', CASE v_negocio.tp_pagamento
      WHEN 'financiado' THEN 'financiamento bancário'
      WHEN 'a_vista' THEN 'à vista'
    END,
    'pagamento_financiado', CASE WHEN v_negocio.tp_pagamento = 'financiado' THEN 'sim' END,
    'pagamento_a_vista', CASE WHEN v_negocio.tp_pagamento = 'a_vista' THEN 'sim' END,
    'imovel_sinal', soma.fn_formatar_moeda(NULLIF(v_negocio.vl_sinal, 0)),
    'imovel_sinal_extenso', soma.fn_valor_extenso(NULLIF(v_negocio.vl_sinal, 0)),
    'imovel_entrada', soma.fn_formatar_moeda(NULLIF(v_negocio.vl_entrada, 0)),
    'imovel_entrada_extenso', soma.fn_valor_extenso(NULLIF(v_negocio.vl_entrada, 0)),
    'imovel_usa_fgts', CASE WHEN v_negocio.sn_usa_fgts THEN 'sim' END,
    'imovel_fgts', soma.fn_formatar_moeda(NULLIF(v_negocio.vl_fgts, 0)),
    'imovel_fgts_extenso', soma.fn_valor_extenso(NULLIF(v_negocio.vl_fgts, 0)),
    'imovel_financiamento', soma.fn_formatar_moeda(NULLIF(v_negocio.vl_financiamento, 0)),
    'imovel_financiamento_extenso', soma.fn_valor_extenso(NULLIF(v_negocio.vl_financiamento, 0)),
    'imovel_saldo_quitacao', soma.fn_formatar_moeda(NULLIF(v_negocio.vl_saldo_quitacao, 0)),
    'imovel_saldo_quitacao_extenso', soma.fn_valor_extenso(NULLIF(v_negocio.vl_saldo_quitacao, 0)),
    'imovel_banco', v_negocio.ds_banco,
    'imovel_entrega_chaves', v_negocio.ds_entrega_chaves,
    'imovel_itens', v_negocio.ds_itens_imovel,
    -- ", EXCETO FINANCIAMENTO" fica quando há financiamento/hipoteca em aberto
    -- (ou quando ainda não se sabe); só some se a matrícula estiver quitada/livre.
    'imovel_ressalva_onus', CASE WHEN v_negocio.sn_imovel_financiado IS DISTINCT FROM false
      THEN ', EXCETO FINANCIAMENTO' END,
    'imovel_prazo_financiamento', COALESCE(
      NULLIF(trim(v_negocio.ds_prazo_financiamento), ''), '60 (sessenta) dias corridos'
    )
  );

  -- Honorários ---------------------------------------------------
  v_campos := v_campos || jsonb_build_object(
    'honorarios_total', soma.fn_formatar_moeda(v_negocio.vl_honorarios_total),
    'honorarios_total_extenso', soma.fn_valor_extenso(v_negocio.vl_honorarios_total),
    'honorarios_percentual', soma.fn_formatar_percentual(v_negocio.pc_honorarios_total),
    'honorarios_quando', v_negocio.ds_honorarios_quando,
    'honorarios_imobiliaria', soma.fn_formatar_moeda(NULLIF(v_negocio.vl_honorarios_imobiliaria, 0)),
    'honorarios_imobiliaria_extenso', soma.fn_valor_extenso(NULLIF(v_negocio.vl_honorarios_imobiliaria, 0)),
    'honorarios_imobiliaria_percentual', soma.fn_formatar_percentual(v_negocio.pc_honorarios_imobiliaria)
  );

  -- Distribuição pronta, no padrão da cláusula de honorários.
  IF NULLIF(v_negocio.vl_honorarios_imobiliaria, 0) IS NOT NULL THEN
    v_letra := v_letra + 1;
    v_distribuicao := v_distribuicao || (
      chr(96 + v_letra) || ') O valor de ' || soma.fn_formatar_moeda(v_negocio.vl_honorarios_imobiliaria)
      || ' (' || soma.fn_valor_extenso(v_negocio.vl_honorarios_imobiliaria) || ') deverá ser transferido para '
      || COALESCE('o PIX (CNPJ) ' || v_imobiliaria.ds_cnpj, v_vazio)
      || ', de titularidade de ' || COALESCE(v_imobiliaria.nm_imobiliaria, v_vazio) || '.'
    );
  END IF;

  -- Corretores ---------------------------------------------------
  v_i := 0;
  v_nomes := ARRAY[]::TEXT[];
  FOR r IN
    SELECT pc.nm_corretor, pc.vl_honorario, pc.pc_honorario,
           c.ds_cpf, c.ds_creci, c.ds_pix, c.ds_telefone, c.ds_email, c.ds_conta_bancaria,
           c.dt_nascimento
    FROM soma.processo_corretor pc
    LEFT JOIN soma.corretores c ON c.cd_corretor = pc.cd_corretor
    WHERE pc.cd_processo = p_cd_processo
    ORDER BY pc.nr_ordem, pc.nm_corretor
  LOOP
    v_i := v_i + 1;
    v_p := 'corretor_' || v_i;
    v_nomes := v_nomes || r.nm_corretor;
    v_campos := v_campos || jsonb_build_object(
      v_p, r.nm_corretor,
      v_p || '_honorario', soma.fn_formatar_moeda(r.vl_honorario),
      v_p || '_honorario_extenso', soma.fn_valor_extenso(r.vl_honorario),
      v_p || '_percentual', soma.fn_formatar_percentual(r.pc_honorario),
      v_p || '_cpf', r.ds_cpf,
      v_p || '_creci', r.ds_creci,
      v_p || '_pix', r.ds_pix,
      v_p || '_telefone', r.ds_telefone,
      v_p || '_email', r.ds_email,
      v_p || '_conta', r.ds_conta_bancaria,
      v_p || '_nascimento', to_char(r.dt_nascimento, 'DD/MM/YYYY')
    );

    IF NULLIF(r.vl_honorario, 0) IS NOT NULL THEN
      v_destino := CASE
        WHEN NULLIF(trim(r.ds_pix), '') IS NOT NULL THEN 'o PIX ' || r.ds_pix
        WHEN NULLIF(trim(r.ds_conta_bancaria), '') IS NOT NULL THEN 'a conta ' || r.ds_conta_bancaria
        ELSE v_vazio
      END;
      v_letra := v_letra + 1;
      v_distribuicao := v_distribuicao || (
        chr(96 + v_letra) || ') O valor de ' || soma.fn_formatar_moeda(r.vl_honorario)
        || ' (' || soma.fn_valor_extenso(r.vl_honorario) || ') deverá ser transferido para '
        || v_destino || ', de titularidade de ' || r.nm_corretor || '.'
      );
    END IF;
  END LOOP;

  v_fallback := NULL;
  IF cardinality(v_nomes) = 0 THEN
    SELECT nm_usuario INTO v_fallback FROM soma.usuarios WHERE cd_usuario = v_processo.cd_corretor;
  END IF;

  v_campos := v_campos || jsonb_build_object(
    'corretor', COALESCE(soma.fn_juntar_nomes(v_nomes), v_fallback),
    'honorarios_distribuicao', NULLIF(array_to_string(v_distribuicao, E'\n\n'), '')
  );

  -- Blocos condicionais primeiro, depois a troca dos campos ---------
  v_conteudo := soma.fn_aplicar_secoes(v_conteudo, v_campos);

  FOR v_chave, v_valor IN SELECT key, value FROM jsonb_each_text(v_campos) LOOP
    v_conteudo := replace(
      v_conteudo,
      '{{' || v_chave || '}}',
      v_ini || COALESCE(NULLIF(trim(v_valor), ''), v_vazio) || v_fim
    );
  END LOOP;

  v_conteudo := regexp_replace(
    v_conteudo,
    '\{\{(vendedor|comprador|corretor)_[0-9]+(_[a-z_]+)?\}\}',
    v_ini || v_vazio || v_fim,
    'g'
  );

  RETURN v_conteudo;
END;
$$;

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
    ds_nire, ds_tipo_societario, ds_representacao
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
    NULLIF(parte->>'ds_representacao', '')
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
        ds_nire, ds_tipo_societario, ds_representacao
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
        NULLIF(v_parte->>'ds_representacao', '')
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
        ds_representacao = NULLIF(v_parte->>'ds_representacao', '')
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

-- ----------------------------------------------------------------
-- Modelos de contrato. Troca só os trechos conhecidos (um modelo editado à
-- mão que não tenha o trecho fica como está) e normaliza as quebras de
-- linha do Windows (CRLF) que atrapalhavam os parágrafos.
-- ----------------------------------------------------------------
DO $modelos$
DECLARE
  m RECORD;
  v_texto TEXT;
  v_linha TEXT := repeat('_', 41);
BEGIN
  FOR m IN SELECT * FROM soma.modelos_contrato LOOP
    v_texto := replace(m.ds_conteudo, E'\r\n', E'\n');

    -- Alíneas da cláusula terceira (sinal = a, entrada = b, financiamento = c).
    IF v_texto NOT LIKE '%a) {{imovel_sinal}}%' THEN
      v_texto := replace(v_texto,
        '{{imovel_sinal}} ({{imovel_sinal_extenso}}) a título de sinal',
        'a) {{imovel_sinal}} ({{imovel_sinal_extenso}}) a título de sinal');
      v_texto := replace(v_texto,
        '{{#imovel_entrada}}{{imovel_entrada}} ({{imovel_entrada_extenso}}) a título de entrada',
        '{{#imovel_entrada}}b) {{imovel_entrada}} ({{imovel_entrada_extenso}}) a título de entrada');
      v_texto := replace(v_texto,
        E'\n\n{{imovel_entrada}} ({{imovel_entrada_extenso}}) a título de entrada',
        E'\n\nb) {{imovel_entrada}} ({{imovel_entrada_extenso}}) a título de entrada');
      v_texto := replace(v_texto,
        '{{imovel_financiamento}} ({{imovel_financiamento_extenso}}) que será liquidada',
        'c) {{imovel_financiamento}} ({{imovel_financiamento_extenso}}) que será liquidada');
    END IF;

    -- 3.2: prazo do financiamento vira campo (fica em vermelho).
    v_texto := replace(v_texto,
      'em até 60 (sessenta) dias corridos a partir da presente data',
      'em até {{imovel_prazo_financiamento}} a partir da presente data');

    -- Cláusula quarta: "EXCETO FINANCIAMENTO" só quando há ônus de financiamento.
    v_texto := replace(v_texto,
      'ônus reais, EXCETO FINANCIAMENTO, bem como',
      'ônus reais{{#imovel_ressalva_onus}}{{imovel_ressalva_onus}}{{/imovel_ressalva_onus}}, bem como');

    -- Cláusula sexta: prazo das chaves vem do processo.
    v_texto := replace(v_texto,
      'no prazo máximo de 00 (XXXX) dias corridos APÓS',
      'no prazo máximo de {{#imovel_entrega_chaves}}{{imovel_entrega_chaves}}{{/imovel_entrega_chaves}}{{^imovel_entrega_chaves}}00 (XXXX) dias corridos{{/imovel_entrega_chaves}} APÓS');

    -- Assinaturas: uma linha por pessoa (empresa mantém as duas dos representantes).
    v_texto := replace(v_texto,
      E'PROMITENTE VENDEDOR\n\n' || v_linha || ' ' || v_linha || E'\n\n{{#vendedor_1_pj}}',
      E'PROMITENTE VENDEDOR\n\n{{#vendedor_1_pj}}' || v_linha || ' ' || v_linha
        || '{{/vendedor_1_pj}}{{^vendedor_1_pj}}' || v_linha || '{{#vendedor_2}} ' || v_linha
        || E'{{/vendedor_2}}{{/vendedor_1_pj}}\n\n{{#vendedor_1_pj}}');
    v_texto := replace(v_texto,
      E'PROMITENTE COMPRADOR\n\n' || v_linha || E'\n\n{{comprador_1}}',
      E'PROMITENTE COMPRADOR\n\n' || v_linha || '{{#comprador_2}} ' || v_linha
        || E'{{/comprador_2}}\n\n{{comprador_1}}');

    IF v_texto IS DISTINCT FROM m.ds_conteudo THEN
      INSERT INTO soma.modelo_contrato_versoes (cd_modelo, nr_versao, nm_modelo, ds_conteudo, cd_editor)
      VALUES (m.cd_modelo, m.nr_versao, m.nm_modelo, m.ds_conteudo, m.cd_editor)
      ON CONFLICT (cd_modelo, nr_versao) DO NOTHING;

      UPDATE soma.modelos_contrato
      SET ds_conteudo = v_texto, nr_versao = m.nr_versao + 1, ts_atualizacao = now()
      WHERE cd_modelo = m.cd_modelo;
    END IF;
  END LOOP;
END
$modelos$;
