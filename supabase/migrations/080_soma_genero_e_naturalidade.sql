-- ================================================================
-- SOMA — Migration 080
-- Comparação do PDF do sistema com o Word preenchido pela equipe (3/11):
--   * Concordância de gênero no contrato: Maria saía no masculino e João no feminino
--     (o modelo escrevia "brasileiro/nascido/portador/inscrito" fixo pra 1ª pessoa e o
--     feminino fixo pra 2ª); o corretor Alan saía "corretora". Agora o texto usa os campos
--     {{<pessoa>_g_brasileiro}}, {{..._g_nascido}} etc., decididos por fn_genero: o sexo lido
--     do documento (CNH) ou, sem ele, o primeiro nome (heurística; o Jurídico confere na
--     prévia, onde esses valores aparecem em vermelho).
--   * Naturalidade: usa a mais completa (cidade/UF) lida nos documentos da pessoa; se a CNH não
--     traz a cidade, usa a da certidão de casamento (naturalidade_conjuge_1/2, casada com o
--     nome da pessoa). "Santo Amaro-BA" sai "Santo Amaro/BA".
--   * Modelos já cadastrados: troca as palavras fixas pelos campos acima.
--
-- Reemite fn_render_modelo_contrato (079) e cria fn_genero e fn_naturalidade_da_parte.
-- Rodar depois da 079.
-- ================================================================

-- Gênero da pessoa: 'F' ou 'M'. Sexo lido do documento; senão, o primeiro nome.
CREATE OR REPLACE FUNCTION soma.fn_genero(p_cd_parte UUID, p_nome TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SET search_path = soma, public AS $$
DECLARE
  v_sexo TEXT;
  v_pn TEXT;
  v_femininos CONSTANT TEXT[] := ARRAY[
    'beatriz', 'raquel', 'rachel', 'isabel', 'ruth', 'rute', 'carmen', 'mercedes', 'ingrid', 'karen',
    'jennifer', 'elizabeth', 'iris', 'lais', 'simone', 'joyce', 'alice', 'denise', 'aline', 'viviane',
    'adriane', 'luciane', 'josiane', 'eliane', 'daniele', 'michele', 'miriam', 'abigail', 'ester',
    'esther', 'liz', 'nicole', 'solange', 'maristela', 'consuelo', 'dolores', 'rosemere', 'rosimere',
    'jaqueline', 'jacqueline', 'emanuelle', 'emanuele', 'gisele', 'giselle', 'ariane', 'tatiane',
    'tatiana', 'cristiane', 'fabiane', 'ivone', 'yvone', 'zuleide', 'raimunda'
  ];
  v_masculinos_em_a CONSTANT TEXT[] := ARRAY['luca', 'joshua', 'mustafa', 'josua', 'noa', 'jonata', 'jhonata'];
BEGIN
  IF p_cd_parte IS NOT NULL THEN
    v_sexo := upper(left(trim(COALESCE(soma.fn_campo_ocr_da_parte(p_cd_parte, 'sexo'), '')), 1));
    IF v_sexo IN ('M', 'F') THEN
      RETURN v_sexo;
    END IF;
  END IF;

  v_pn := lower(split_part(trim(COALESCE(p_nome, '')), ' ', 1));
  v_pn := translate(v_pn, 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
  IF v_pn = '' THEN
    RETURN 'M';
  END IF;
  IF v_pn = ANY (v_femininos) THEN
    RETURN 'F';
  END IF;
  IF v_pn = ANY (v_masculinos_em_a) THEN
    RETURN 'M';
  END IF;
  RETURN CASE WHEN right(v_pn, 1) = 'a' THEN 'F' ELSE 'M' END;
END;
$$;

-- Naturalidade: a mais completa lida nos documentos de identidade da pessoa; se só tem a UF
-- (ou nada), a da certidão de casamento, no cônjuge cujo nome bate com o da pessoa.
CREATE OR REPLACE FUNCTION soma.fn_naturalidade_da_parte(p_cd_parte UUID, p_nome TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE SET search_path = soma, public AS $$
DECLARE
  v_propria TEXT;
  v_i INTEGER;
  v_nome_cert TEXT;
  v_nat TEXT;
  v_pn TEXT[];
  v_cn TEXT[];
  v_stop CONSTANT TEXT[] := ARRAY['de', 'da', 'do', 'dos', 'das', 'e'];
BEGIN
  SELECT c.ds_valor INTO v_propria
  FROM soma.documento_ocr_campos c
  JOIN soma.documento_ocr o ON o.cd_documento_ocr = c.cd_documento_ocr
  JOIN soma.documentos d ON d.cd_documento = o.cd_documento
  WHERE d.cd_parte = p_cd_parte
    AND c.nm_campo = 'naturalidade'
    AND d.tp_categoria_intake = 'identidade'
    AND d.tp_status <> 'rejeitado'
    AND NULLIF(trim(c.ds_valor), '') IS NOT NULL
  ORDER BY c.sn_confirmado DESC, length(c.ds_valor) DESC, c.nr_confianca DESC NULLS LAST
  LIMIT 1;

  -- já tem cidade e UF ("Salvador/BA", "Santo Amaro - BA"): vale
  IF v_propria ~ '[A-Za-z]{3,}.*[/,-]\s*[A-Za-z]{2}\s*$' THEN
    RETURN v_propria;
  END IF;

  v_pn := ARRAY(
    SELECT t FROM unnest(regexp_split_to_array(
      lower(translate(COALESCE(p_nome, ''), 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')),
      '\s+')) AS t
    WHERE t <> '' AND NOT (t = ANY (v_stop))
  );

  FOR v_i IN 1..2 LOOP
    v_nome_cert := soma.fn_campo_ocr_do_casal(p_cd_parte, 'nome_conjuge_' || v_i);
    v_nat := soma.fn_campo_ocr_do_casal(p_cd_parte, 'naturalidade_conjuge_' || v_i);
    CONTINUE WHEN v_nome_cert IS NULL OR v_nat IS NULL;

    v_cn := ARRAY(
      SELECT t FROM unnest(regexp_split_to_array(
        lower(translate(v_nome_cert, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuucaaaaaeeeeiiiiooooouuuuc')),
        '\s+')) AS t
      WHERE t <> '' AND NOT (t = ANY (v_stop))
    );
    IF v_pn[1] = v_cn[1] AND (SELECT count(*) FROM unnest(v_pn) a WHERE a = ANY (v_cn)) >= 2 THEN
      RETURN v_nat;
    END IF;
  END LOOP;

  RETURN v_propria;
END;
$$;

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

-- ----------------------------------------------------------------
-- Modelos já cadastrados: as palavras fixas viram os campos de gênero. Só mexe onde o trecho
-- existe (modelo editado pela tela e sem o trecho = nada muda).
-- ----------------------------------------------------------------
UPDATE soma.modelos_contrato SET ds_conteudo =
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(
  regexp_replace(ds_conteudo,
    '\{\{(vendedor|comprador)_([0-9])\}\}, brasileir[oa], maior, capaz,',
    '{{\1_\2}}, {{\1_\2_g_brasileiro}}, maior, capaz,', 'g'),
    'nascid[oa] em \{\{(vendedor|comprador)_([0-9])_nascimento\}\}',
    '{{\1_\2_g_nascido}} em {{\1_\2_nascimento}}', 'g'),
    '\{\{(vendedor|comprador)_([0-9])_filiacao\}\}, portadora? da cédula',
    '{{\1_\2_filiacao}}, {{\1_\2_g_portador}} da cédula', 'g'),
    'inscrit[oa] no CPF/MF sob nº \{\{(vendedor|comprador)_([0-9])_cpf\}\}',
    '{{\1_\2_g_inscrito}} no CPF/MF sob nº {{\1_\2_cpf}}', 'g'),
    'residente e domiciliad[oa] na \{\{(vendedor|comprador)_1_endereco\}\}',
    'residente e {{\1_1_g_domiciliado}} na {{\1_1_endereco}}', 'g'),
    'casado sob o regime da \{\{(vendedor|comprador)_2_regime_bens\}\} com',
    '{{\1_1_g_casado}} sob o regime da {{\1_2_regime_bens}} com', 'g'),
    '\{\{\^comprador_2\}\}solteiro e declara',
    '{{^comprador_2}}{{comprador_1_g_solteiro}} e declara', 'g'),
    '\{\{corretor_([0-9])\}\}, brasileira, maior, capaz, corretora de imóveis,',
    '{{corretor_\1}}, {{corretor_\1_g_brasileiro}}, maior, capaz, {{corretor_\1_g_corretor}} de imóveis,', 'g')
WHERE ds_conteudo ~ '(brasileir[oa], maior, capaz|corretora de imóveis|solteiro e declara|casado sob o regime)';

UPDATE soma.modelos_contrato SET ds_conteudo =
  regexp_replace(
  regexp_replace(ds_conteudo,
    'regularmente inscrita no CRECI-PF/BA \{\{corretor_([0-9])_creci\}\}',
    'regularmente {{corretor_\1_g_inscrito}} no CRECI-PF/BA {{corretor_\1_creci}}', 'g'),
    '(\{\{corretor_([0-9])_cpf\}\}), residente e domiciliada nesta Capital',
    '\1, residente e {{corretor_\2_g_domiciliado}} nesta Capital', 'g')
WHERE ds_conteudo ~ '(regularmente inscrita no CRECI-PF/BA|residente e domiciliada nesta Capital)';
