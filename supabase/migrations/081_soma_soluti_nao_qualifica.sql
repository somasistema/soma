-- ================================================================
-- SOMA — Migration 081
-- "SOMA SOLUTI" não é imobiliária de contrato (pedido da cliente, 4/11): a SOMA não é
-- qualificada no contrato e não recebe valores.
--   * soma.imobiliarias.sn_qualifica_contrato (padrão true). Com false, escolher essa
--     imobiliária no processo deixa o contrato como se não houvesse imobiliária: some a
--     qualificação dela na cláusula de corretagem e a linha dela na distribuição dos honorários.
--   * O cadastro "SOMA Assessoria Imobiliária" passa a se chamar "SOMA SOLUTI" e a não ser
--     qualificado. (Configurações › Imobiliárias tem a caixa pra mudar isso em qualquer uma.)
--
-- Reemite fn_render_modelo_contrato (080). Rodar depois da 080.
-- ================================================================

ALTER TABLE soma.imobiliarias ADD COLUMN IF NOT EXISTS sn_qualifica_contrato BOOLEAN NOT NULL DEFAULT true;

UPDATE soma.imobiliarias
SET nm_imobiliaria = 'SOMA SOLUTI', sn_qualifica_contrato = false
WHERE nm_imobiliaria ILIKE 'soma assessoria%';

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
  v_imob_contrato BOOLEAN;
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
  v_conta TEXT;
  v_titular TEXT;
  v_gen TEXT;
  v_corte INTEGER;
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
  -- A SOMA (sn_qualifica_contrato = false) não é qualificada no contrato nem recebe valores: se é a
  -- "imobiliária" do processo, o contrato sai como se não houvesse imobiliária.
  v_imob_contrato := v_processo.cd_imobiliaria IS NOT NULL AND COALESCE(v_imobiliaria.sn_qualifica_contrato, true);

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
    'imobiliaria', CASE WHEN v_imob_contrato THEN v_imobiliaria.nm_imobiliaria END,
    'imobiliaria_cnpj', CASE WHEN v_imob_contrato THEN v_imobiliaria.ds_cnpj END,
    'imobiliaria_creci', CASE WHEN v_imob_contrato THEN v_imobiliaria.ds_creci END,
    'imobiliaria_endereco', CASE WHEN v_imob_contrato THEN v_imobiliaria.ds_endereco END
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
        v_p || '_profissao', lower(NULLIF(trim(r.ds_profissao), '')),
        v_p || '_telefone', r.ds_telefone,
        v_p || '_email', r.ds_email,
        v_p || '_conta', r.ds_conta_bancaria,
        v_p || '_endereco', soma.fn_capitalizar(r.ds_endereco, true),
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
        v_p || '_naturalidade', regexp_replace(soma.fn_capitalizar(soma.fn_naturalidade_da_parte(r.cd_parte, r.nm_parte), true), '\s*[-,]\s*([A-Za-z]{2})\s*$', '/\1'),
        v_p || '_nome_pai', soma.fn_capitalizar(soma.fn_campo_ocr_da_parte(r.cd_parte, 'nome_pai')),
        v_p || '_nome_mae', soma.fn_capitalizar(soma.fn_campo_ocr_da_parte(r.cd_parte, 'nome_mae')),
        v_p || '_filiacao', soma.fn_juntar_nomes(array_remove(ARRAY[
          soma.fn_capitalizar(soma.fn_campo_ocr_da_parte(r.cd_parte, 'nome_pai')),
          soma.fn_capitalizar(soma.fn_campo_ocr_da_parte(r.cd_parte, 'nome_mae'))
        ], NULL)),
        v_p || '_regime_bens', soma.fn_campo_ocr_do_casal(r.cd_parte, 'regime_bens'),
        v_p || '_estado_civil', lower(soma.fn_campo_ocr_do_casal(r.cd_parte, 'estado_civil'))
      );

      -- Pessoa jurídica: o CNPJ mora no mesmo campo do CPF; 14 dígitos = empresa.
      v_campos := v_campos || jsonb_build_object(
        v_p || '_pj', CASE WHEN length(regexp_replace(COALESCE(r.ds_cpf, ''), '\D', '', 'g')) = 14 THEN 'sim' END,
        v_p || '_documento_tipo', CASE WHEN length(regexp_replace(COALESCE(r.ds_cpf, ''), '\D', '', 'g')) = 14 THEN 'CNPJ' ELSE 'CPF' END,
        v_p || '_nire', r.ds_nire,
        v_p || '_tipo_societario', r.ds_tipo_societario
      );

      -- Concordância de gênero do texto do contrato (brasileiro/brasileira, nascido/nascida...).
      v_gen := soma.fn_genero(r.cd_parte, r.nm_parte);
      v_campos := v_campos || jsonb_build_object(
        v_p || '_g_brasileiro', CASE WHEN v_gen = 'F' THEN 'brasileira' ELSE 'brasileiro' END,
        v_p || '_g_nascido', CASE WHEN v_gen = 'F' THEN 'nascida' ELSE 'nascido' END,
        v_p || '_g_portador', CASE WHEN v_gen = 'F' THEN 'portadora' ELSE 'portador' END,
        v_p || '_g_inscrito', CASE WHEN v_gen = 'F' THEN 'inscrita' ELSE 'inscrito' END,
        v_p || '_g_domiciliado', CASE WHEN v_gen = 'F' THEN 'domiciliada' ELSE 'domiciliado' END,
        v_p || '_g_casado', CASE WHEN v_gen = 'F' THEN 'casada' ELSE 'casado' END,
        v_p || '_g_solteiro', CASE WHEN v_gen = 'F' THEN 'solteira' ELSE 'solteiro' END
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

    -- Conta bancária: o modelo usa {{<lado>_1_conta}}. Vale a da primeira pessoa do lado que tiver
    -- (ex.: cadastrada no cônjuge) e o titular é essa pessoa: {{<lado>_conta_titular}}.
    v_conta := NULL;
    v_titular := NULL;
    SELECT ds_conta_bancaria, nm_parte INTO v_conta, v_titular
    FROM soma.processo_parte
    WHERE cd_processo = p_cd_processo AND tp_lado = v_lado
      AND NULLIF(trim(COALESCE(ds_conta_bancaria, '')), '') IS NOT NULL
    ORDER BY nr_ordem, nm_parte
    LIMIT 1;
    IF v_conta IS NOT NULL THEN
      v_campos := v_campos || jsonb_build_object(v_lado || '_1_conta', v_conta);
    END IF;
    v_campos := v_campos || jsonb_build_object(v_lado || '_conta_titular', v_titular);

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
    'honorarios_imobiliaria', CASE WHEN v_imob_contrato THEN soma.fn_formatar_moeda(NULLIF(v_negocio.vl_honorarios_imobiliaria, 0)) END,
    'honorarios_imobiliaria_extenso', CASE WHEN v_imob_contrato THEN soma.fn_valor_extenso(NULLIF(v_negocio.vl_honorarios_imobiliaria, 0)) END,
    'honorarios_imobiliaria_percentual', CASE WHEN v_imob_contrato THEN soma.fn_formatar_percentual(v_negocio.pc_honorarios_imobiliaria) END
  );

  -- Distribuição pronta, no padrão da cláusula de honorários.
  IF v_imob_contrato AND NULLIF(v_negocio.vl_honorarios_imobiliaria, 0) IS NOT NULL THEN
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
    v_gen := soma.fn_genero(NULL, r.nm_corretor);
    v_campos := v_campos || jsonb_build_object(
      v_p || '_g_brasileiro', CASE WHEN v_gen = 'F' THEN 'brasileira' ELSE 'brasileiro' END,
      v_p || '_g_corretor', CASE WHEN v_gen = 'F' THEN 'corretora' ELSE 'corretor' END,
      v_p || '_g_inscrito', CASE WHEN v_gen = 'F' THEN 'inscrita' ELSE 'inscrito' END,
      v_p || '_g_domiciliado', CASE WHEN v_gen = 'F' THEN 'domiciliada' ELSE 'domiciliado' END
    );
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

  -- Locação: prazo, valores, caução, seguro etc. (vazio em contrato de venda)
  v_campos := v_campos || soma.fn_campos_locacao(p_cd_processo);

  -- Blocos condicionais primeiro, depois a troca dos campos ---------
  v_conteudo := soma.fn_aplicar_secoes(v_conteudo, v_campos);

  FOR v_chave, v_valor IN SELECT key, value FROM jsonb_each_text(v_campos) LOOP
    v_conteudo := replace(
      v_conteudo,
      '{{' || v_chave || '}}',
      v_ini || CASE WHEN p_marcar AND v_chave ~ '^(vendedor|comprador)_[0-9]+$' THEN chr(4) ELSE '' END
        || COALESCE(NULLIF(trim(v_valor), ''), v_vazio) || v_fim
    );
  END LOOP;

  v_conteudo := regexp_replace(
    v_conteudo,
    '\{\{(vendedor|comprador|corretor)_[0-9]+(_[a-z_]+)?\}\}',
    v_ini || v_vazio || v_fim,
    'g'
  );

  -- Sublinhado dos nomes: só na qualificação das partes (antes da cláusula segunda).
  v_corte := NULLIF(least(
    COALESCE(NULLIF(strpos(v_conteudo, 'CLÁUSULA SEGUNDA'), 0), 2147483647),
    COALESCE(NULLIF(strpos(v_conteudo, 'CLÁUSULA 2ª'), 0), 2147483647)
  ), 2147483647);
  IF v_corte IS NOT NULL THEN
    v_conteudo := left(v_conteudo, v_corte - 1) || replace(substr(v_conteudo, v_corte), chr(4), '');
  END IF;

  RETURN v_conteudo;
END;
$$;
