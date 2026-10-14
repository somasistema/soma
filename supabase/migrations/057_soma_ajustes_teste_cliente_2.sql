-- ================================================================
-- SOMA — Migration 057
-- Segunda rodada de ajustes do teste do cliente (14/10/2026):
--
--   1) Imobiliária opcional no processo; imobiliária ganha CRECI e
--      endereço (pra qualificação no contrato).
--   2) Partes ganham CPF, RG, data de nascimento, endereço e o vínculo
--      da 2ª pessoa (cônjuge / companheiro(a) / outra pessoa).
--      Corretor ganha data de nascimento.
--   3) Pagamento: sinal, entrada, financiado x à vista, FGTS, saldo
--      financiado / saldo para quitação; cartório de imóveis.
--   4) Categoria "declaração de união estável"; IPTU e ônus/escritura
--      passam a ser documentos DO IMÓVEL (não de cada vendedor).
--   5) Render da minuta: blocos condicionais {{#campo}}...{{/campo}} e
--      {{^campo}}...{{/campo}}, campos novos, e a minuta gerada guarda
--      a marcação dos campos (pra tela mostrar em vermelho).
--   6) Os 3 modelos de compra e venda importados (046) passam a usar os
--      campos — só se ainda estiverem na versão 1 (nunca editados).
--   7) fn_excluir_processo.
--   0) Corrige a 5ª aprovação da minuta (coluna curta demais).
-- ================================================================

-- ----------------------------------------------------------------
-- 0) Bug: "aguardando_assinatura" tem 21 letras e as colunas eram
--    VARCHAR(20) — a 5ª aprovação da minuta quebrava ao criar o
--    contrato ("value too long for type character varying(20)").
-- ----------------------------------------------------------------
ALTER TABLE soma.processos ALTER COLUMN tp_etapa_contrato TYPE VARCHAR(30);
ALTER TABLE soma.contratos ALTER COLUMN tp_status TYPE VARCHAR(30);

-- ----------------------------------------------------------------
-- 1) Colunas novas
-- ----------------------------------------------------------------
ALTER TABLE soma.imobiliarias
  ADD COLUMN IF NOT EXISTS ds_creci VARCHAR(40),
  ADD COLUMN IF NOT EXISTS ds_endereco TEXT;

-- Dados da Simone que estavam fixos no texto dos modelos.
UPDATE soma.imobiliarias SET
  ds_creci = COALESCE(ds_creci, '1.617'),
  ds_endereco = COALESCE(ds_endereco, 'Rua dos Colibris, nº 79, Edifício Empresarial Paralela Place, Sala 603, Imbuí, Salvador/BA, CEP 41.720-060'),
  ds_cnpj = COALESCE(ds_cnpj, '17.873.416/0001-17')
WHERE regexp_replace(COALESCE(ds_cnpj, ''), '\D', '', 'g') = '17873416000117'
   OR upper(nm_imobiliaria) LIKE 'SIMONE NASCIMENTO%';

ALTER TABLE soma.corretores
  ADD COLUMN IF NOT EXISTS dt_nascimento DATE;

ALTER TABLE soma.processo_parte
  ADD COLUMN IF NOT EXISTS ds_cpf VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ds_rg VARCHAR(40),
  ADD COLUMN IF NOT EXISTS dt_nascimento DATE,
  ADD COLUMN IF NOT EXISTS ds_endereco TEXT,
  -- vínculo com a pessoa anterior do mesmo lado (2º vendedor em diante)
  ADD COLUMN IF NOT EXISTS tp_vinculo VARCHAR(20);

ALTER TABLE soma.processo_parte DROP CONSTRAINT IF EXISTS processo_parte_tp_vinculo_check;
ALTER TABLE soma.processo_parte ADD CONSTRAINT processo_parte_tp_vinculo_check
  CHECK (tp_vinculo IS NULL OR tp_vinculo IN ('conjuge', 'companheiro', 'outro'));

ALTER TABLE soma.processo_negocio
  ADD COLUMN IF NOT EXISTS tp_pagamento VARCHAR(20),
  ADD COLUMN IF NOT EXISTS vl_sinal NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS sn_usa_fgts BOOLEAN,
  ADD COLUMN IF NOT EXISTS vl_fgts NUMERIC(15, 2),
  ADD COLUMN IF NOT EXISTS vl_saldo_quitacao NUMERIC(15, 2),
  -- código do cartório: salvador-1..7, lauro-de-freitas-1, camacari-1/2
  ADD COLUMN IF NOT EXISTS ds_imovel_cartorio VARCHAR(40);

ALTER TABLE soma.processo_negocio DROP CONSTRAINT IF EXISTS processo_negocio_tp_pagamento_check;
ALTER TABLE soma.processo_negocio ADD CONSTRAINT processo_negocio_tp_pagamento_check
  CHECK (tp_pagamento IS NULL OR tp_pagamento IN ('financiado', 'a_vista'));

ALTER TABLE soma.documentos DROP CONSTRAINT IF EXISTS documentos_tp_categoria_intake_check;
ALTER TABLE soma.documentos ADD CONSTRAINT documentos_tp_categoria_intake_check
  CHECK (tp_categoria_intake IN (
    'identidade', 'estado_civil', 'comprovante_residencia', 'onus_escritura', 'iptu', 'uniao_estavel'
  ));

-- ----------------------------------------------------------------
-- 2) Helpers
-- ----------------------------------------------------------------

-- "salvador-3" -> {numero: "3º", cidade: "Salvador"}
CREATE OR REPLACE FUNCTION soma.fn_cartorio_partes(p_codigo TEXT)
RETURNS TABLE (numero TEXT, cidade TEXT)
LANGUAGE sql IMMUTABLE SET search_path = soma, public AS $$
  SELECT
    substring(p_codigo FROM '-(\d+)$') || 'º',
    CASE substring(p_codigo FROM '^(.*)-\d+$')
      WHEN 'salvador' THEN 'Salvador'
      WHEN 'lauro-de-freitas' THEN 'Lauro de Freitas'
      WHEN 'camacari' THEN 'Camaçari'
    END
  WHERE p_codigo ~ '^[a-z-]+-\d+$';
$$;

-- Blocos condicionais no texto do modelo:
--   {{#campo}}...{{/campo}}  entra só se o campo tiver valor
--   {{^campo}}...{{/campo}}  entra só se o campo estiver vazio
-- Pode aninhar blocos de campos diferentes.
CREATE OR REPLACE FUNCTION soma.fn_aplicar_secoes(p_texto TEXT, p_campos JSONB)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = soma, public AS $$
DECLARE
  v_texto TEXT := p_texto;
  v_ini INTEGER;
  v_a INTEGER;
  v_b INTEGER;
  v_k INTEGER;
  v_m INTEGER;
  v_tipo TEXT;
  v_nome TEXT;
  v_fecha TEXT;
  v_miolo TEXT;
  v_tem BOOLEAN;
  v_guarda INTEGER := 0;
BEGIN
  LOOP
    v_guarda := v_guarda + 1;
    EXIT WHEN v_guarda > 1000;

    v_a := strpos(v_texto, '{{#');
    v_b := strpos(v_texto, '{{^');
    v_ini := CASE
      WHEN v_a = 0 THEN v_b
      WHEN v_b = 0 THEN v_a
      ELSE least(v_a, v_b)
    END;
    EXIT WHEN v_ini = 0;

    v_tipo := substr(v_texto, v_ini + 2, 1);
    v_k := strpos(substr(v_texto, v_ini), '}}');
    IF v_k = 0 THEN
      EXIT;
    END IF;
    v_nome := substr(v_texto, v_ini + 3, v_k - 4);
    v_fecha := '{{/' || v_nome || '}}';
    v_m := strpos(substr(v_texto, v_ini + v_k + 1), v_fecha);

    IF v_m = 0 THEN
      -- abertura sem fechamento: some só a tag
      v_texto := overlay(v_texto PLACING '' FROM v_ini FOR v_k + 1);
      CONTINUE;
    END IF;

    v_miolo := substr(v_texto, v_ini + v_k + 1, v_m - 1);
    v_tem := NULLIF(trim(COALESCE(p_campos->>v_nome, '')), '') IS NOT NULL;
    IF v_tipo = '^' THEN
      v_tem := NOT v_tem;
    END IF;

    v_texto := overlay(
      v_texto PLACING (CASE WHEN v_tem THEN v_miolo ELSE '' END)
      FROM v_ini FOR (v_k + 1) + (v_m - 1) + length(v_fecha)
    );
  END LOOP;

  RETURN v_texto;
END;
$$;

-- ----------------------------------------------------------------
-- 3) Render da minuta
-- ----------------------------------------------------------------
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

      -- Vínculo com a pessoa anterior (2ª em diante). Sem vínculo
      -- informado = cônjuge (como a tela rotulava antes).
      IF v_i >= 2 THEN
        v_vinculo := COALESCE(r.tp_vinculo, 'conjuge');
        v_campos := v_campos || jsonb_build_object(
          v_p || '_vinculo', CASE v_vinculo
            WHEN 'conjuge' THEN 'cônjuge'
            WHEN 'companheiro' THEN 'companheiro(a)'
            ELSE 'outra pessoa'
          END,
          v_p || '_conjuge', CASE WHEN v_vinculo = 'conjuge' THEN 'sim' END,
          v_p || '_companheiro', CASE WHEN v_vinculo = 'companheiro' THEN 'sim' END,
          v_p || '_outro', CASE WHEN v_vinculo = 'outro' THEN 'sim' END
        );
      END IF;
    END LOOP;

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
    'imovel_itens', v_negocio.ds_itens_imovel
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

-- A minuta gerada guarda a marcação (chr(2)/chr(3)) dos campos que
-- vieram do processo: a tela pinta de vermelho e o PDF pra assinatura
-- tira as marcas.
CREATE OR REPLACE FUNCTION soma.fn_gerar_minuta_de_modelo(
  p_cd_processo UUID,
  p_cd_modelo UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  RETURN soma.fn_registrar_minuta(
    p_cd_processo,
    NULL,
    soma.fn_render_modelo_contrato(p_cd_processo, p_cd_modelo, true)
  );
END;
$$;

-- ----------------------------------------------------------------
-- 4) fn_salvar_dados_negocio — campos novos
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
    ds_cpf, ds_rg, dt_nascimento, ds_endereco, tp_vinculo
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
    NULLIF(parte->>'tp_vinculo', '')
  FROM jsonb_array_elements(COALESCE(p_partes, '[]'::jsonb)) AS parte
  WHERE NULLIF(trim(parte->>'nm_parte'), '') IS NOT NULL;

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

-- ----------------------------------------------------------------
-- 5) Autoatendimento da parte
-- ----------------------------------------------------------------

-- Par (cônjuge/companheiro) de uma parte: a pessoa anterior do mesmo
-- lado, se ESTA tem vínculo; ou a próxima, se a próxima tem vínculo
-- com esta. "outra pessoa" não forma par.
CREATE OR REPLACE FUNCTION soma.fn_par_da_parte(p_cd_parte UUID)
RETURNS TABLE (cd_parte UUID, nm_parte VARCHAR, tp_vinculo VARCHAR)
LANGUAGE sql STABLE SET search_path = soma, public AS $$
  WITH eu AS (
    SELECT * FROM soma.processo_parte WHERE cd_parte = p_cd_parte
  ),
  lado AS (
    SELECT pp.*, row_number() OVER (ORDER BY pp.nr_ordem, pp.nm_parte) AS rn
    FROM soma.processo_parte pp, eu
    WHERE pp.cd_processo = eu.cd_processo AND pp.tp_lado = eu.tp_lado
      AND pp.tp_lado IN ('vendedor', 'comprador')
  ),
  meu AS (
    SELECT * FROM lado WHERE cd_parte = p_cd_parte
  )
  SELECT ant.cd_parte, ant.nm_parte, COALESCE(meu.tp_vinculo, 'conjuge')::VARCHAR
  FROM meu JOIN lado ant ON ant.rn = meu.rn - 1
  WHERE meu.rn > 1 AND COALESCE(meu.tp_vinculo, 'conjuge') IN ('conjuge', 'companheiro')
  UNION ALL
  SELECT prox.cd_parte, prox.nm_parte, COALESCE(prox.tp_vinculo, 'conjuge')::VARCHAR
  FROM meu JOIN lado prox ON prox.rn = meu.rn + 1
  WHERE COALESCE(prox.tp_vinculo, 'conjuge') IN ('conjuge', 'companheiro')
    AND NOT (meu.rn > 1 AND COALESCE(meu.tp_vinculo, 'conjuge') IN ('conjuge', 'companheiro'))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION soma.fn_parte_por_token(p_token UUID)
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

GRANT EXECUTE ON FUNCTION soma.fn_parte_por_token TO anon, authenticated;

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
    ds_conta_bancaria = NULLIF(p_dados->>'ds_conta_bancaria', ''),
    ds_cpf = NULLIF(trim(p_dados->>'ds_cpf'), ''),
    ds_rg = NULLIF(trim(p_dados->>'ds_rg'), ''),
    dt_nascimento = NULLIF(p_dados->>'dt_nascimento', '')::date,
    ds_endereco = NULLIF(trim(p_dados->>'ds_endereco'), '')
  WHERE cd_parte = v_cd_parte;
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_atualizar_parte_publico TO anon, authenticated;

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

  IF v_categoria IS NOT NULL AND v_categoria NOT IN (
    'identidade', 'estado_civil', 'comprovante_residencia', 'onus_escritura', 'iptu', 'uniao_estavel'
  ) THEN
    RAISE EXCEPTION 'Categoria de documento inválida.';
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

-- ----------------------------------------------------------------
-- 6) Excluir processo (tudo do processo vai junto, em cascata).
--    Devolve os caminhos no Storage pra aplicação apagar os arquivos.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_excluir_processo(p_cd_processo UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_documentos JSONB;
  v_minutas JSONB;
BEGIN
  IF NOT soma.fn_tem_permissao('processos', 'excluir') THEN
    RAISE EXCEPTION 'Seu perfil não pode excluir processos.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM soma.processos WHERE cd_processo = p_cd_processo) THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;

  SELECT COALESCE(jsonb_agg(ds_storage_url), '[]'::jsonb) INTO v_documentos
  FROM soma.documentos
  WHERE cd_processo = p_cd_processo AND ds_storage_url IS NOT NULL;

  SELECT COALESCE(jsonb_agg(caminho), '[]'::jsonb) INTO v_minutas
  FROM (
    SELECT ds_storage_url AS caminho FROM soma.minutas
    WHERE cd_processo = p_cd_processo AND ds_storage_url IS NOT NULL
    UNION ALL
    SELECT ds_arquivo_assinado_url FROM soma.contratos
    WHERE cd_processo = p_cd_processo AND ds_arquivo_assinado_url IS NOT NULL
  ) s;

  DELETE FROM soma.processos WHERE cd_processo = p_cd_processo;

  RETURN jsonb_build_object('documentos', v_documentos, 'minutas', v_minutas);
END;
$$;

-- ----------------------------------------------------------------
-- 7) Modelos importados passam a usar os campos (só se nunca foram
--    editados — nr_versao = 1). A versão original fica no histórico.
--    Todas as trocas são de trechos de UMA linha, pra não depender da
--    quebra de linha com que o texto foi gravado.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_tmp_atualizar_modelo(p_nome TEXT, p_trocas TEXT[])
RETURNS VOID
LANGUAGE plpgsql SET search_path = soma, public AS $$
DECLARE
  v soma.modelos_contrato%ROWTYPE;
  v_texto TEXT;
  i INTEGER;
BEGIN
  SELECT * INTO v FROM soma.modelos_contrato WHERE nm_modelo = p_nome AND nr_versao = 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_texto := v.ds_conteudo;
  FOR i IN 1..array_length(p_trocas, 1) / 2 LOOP
    v_texto := replace(v_texto, p_trocas[2 * i - 1], p_trocas[2 * i]);
  END LOOP;

  IF v_texto = v.ds_conteudo THEN
    RETURN;
  END IF;

  INSERT INTO soma.modelo_contrato_versoes (cd_modelo, nr_versao, nm_modelo, ds_conteudo, cd_editor)
  VALUES (v.cd_modelo, v.nr_versao, v.nm_modelo, v.ds_conteudo, v.cd_editor)
  ON CONFLICT (cd_modelo, nr_versao) DO NOTHING;

  UPDATE soma.modelos_contrato
  SET ds_conteudo = v_texto, nr_versao = 2, ts_atualizacao = now()
  WHERE cd_modelo = v.cd_modelo;
END;
$$;

-- Honorários de corretagem
SELECT soma.fn_tmp_atualizar_modelo('Honorários de corretagem — compra e venda', ARRAY[
  'De um lado, XXXXXX, brasileiro, maior, capaz, profissão, nascido em 000, natural de XX, filiação de XXXXX, portador da cédula de identidade nº 000 SSP/BA, inscrito no CPF/MF sob nº 0000, casado sob o regime da comunhão parcial de bens com XXXXX, brasileira, maior, capaz, profissão, nascida em 0000, natural de XX, filiação de xxxx, portadora da cédula de identidade nº 000 SSP/BA, inscrita no CPF/MF sob nº 0000, ambos residentes e domiciliados na xxxx.',
  'De um lado, {{vendedor_1}}, brasileiro, maior, capaz, {{vendedor_1_profissao}}, nascido em {{vendedor_1_nascimento}}, natural de XX, filiação de XXXXX, portador da cédula de identidade nº {{vendedor_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{vendedor_1_cpf}}{{#vendedor_2}}{{#vendedor_2_conjuge}}, casado sob o regime da comunhão parcial de bens com {{/vendedor_2_conjuge}}{{#vendedor_2_companheiro}}, convivente em união estável com {{/vendedor_2_companheiro}}{{#vendedor_2_outro}}, e {{/vendedor_2_outro}}{{vendedor_2}}, brasileira, maior, capaz, {{vendedor_2_profissao}}, nascida em {{vendedor_2_nascimento}}, natural de XX, filiação de xxxx, portadora da cédula de identidade nº {{vendedor_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{vendedor_2_cpf}}, ambos residentes e domiciliados na {{vendedor_1_endereco}}{{/vendedor_2}}{{^vendedor_2}}, residente e domiciliado na {{vendedor_1_endereco}}{{/vendedor_2}}.',

  'De outro lado, SIMONE NASCIMENTO LIMA SOLUÇÕES IMOBILIARIAS LTDA, pessoa jurídica, inscrita regularmente no CRECI-PJ/BA nº 1617, CNPJ sob nº 17.873.416/0001-17, com sede na Rua dos Colibris, n 79, Edifício Empresarial Paralela Place, Sala 603, Imbuí, Salvador/BA, CEP 41.720-060, XXXXXXX, brasileira, maior, capaz, corretora de imóveis, CRECI-PF/BA 0000, CPF/MF sob nº 00000, residente e domiciliada nesta Capital e XXXXXXX, brasileira, maior, capaz, corretora de imóveis, CRECI-PF/BA 0000, CPF/MF sob nº 00000, residente e domiciliada nesta Capital.',
  'De outro lado, {{#honorarios_imobiliaria}}{{imobiliaria}}, pessoa jurídica, inscrita regularmente no CRECI-PJ/BA nº {{imobiliaria_creci}}, CNPJ sob nº {{imobiliaria_cnpj}}, com sede na {{imobiliaria_endereco}}, {{/honorarios_imobiliaria}}{{corretor_1}}, brasileira, maior, capaz, corretora de imóveis, CRECI-PF/BA {{corretor_1_creci}}, CPF/MF sob nº {{corretor_1_cpf}}, residente e domiciliada nesta Capital{{#corretor_2}} e {{corretor_2}}, brasileira, maior, capaz, corretora de imóveis, CRECI-PF/BA {{corretor_2_creci}}, CPF/MF sob nº {{corretor_2_cpf}}, residente e domiciliada nesta Capital{{/corretor_2}}{{#corretor_3}} e {{corretor_3}}, brasileira, maior, capaz, corretora de imóveis, CRECI-PF/BA {{corretor_3_creci}}, CPF/MF sob nº {{corretor_3_cpf}}, residente e domiciliada nesta Capital{{/corretor_3}}.',

  'matrícula n. 000 emitida pelo 0º Registro de Imóveis da Comarca de Salvador/BA.',
  'matrícula n. {{imovel_matricula}} emitida pelo {{imovel_cartorio_numero}} Registro de Imóveis da Comarca de {{imovel_cartorio_cidade}}/BA.',

  '2.1 - Endereço (IPTU):',
  '2.1 - Endereço (IPTU): {{imovel_endereco}}{{#imovel_iptu}} — inscrição municipal nº {{imovel_iptu}}{{/imovel_iptu}}',

  'apenas se tratando do(s) cliente(s) XXXXX inscrito no CPF/MF sob nº 0000 e XXXXXX inscrita no CPF/MF sob nº 0000.',
  'apenas se tratando do(s) cliente(s) {{comprador_1}} inscrito no CPF/MF sob nº {{comprador_1_cpf}}{{#comprador_2}} e {{comprador_2}} inscrita no CPF/MF sob nº {{comprador_2_cpf}}{{/comprador_2}}.',

  'pelo preço total de R$00.000,00 (000 mil reais)',
  'pelo preço total de {{imovel_valor}} ({{imovel_valor_extenso}})',

  'a título de honorários, R$ 000,00 (XXXXX), que deverá ser pago no ato da assinatura do contrato de financiamento.',
  'a título de honorários, {{honorarios_total}} ({{honorarios_total_extenso}}), que deverá ser pago {{honorarios_quando}}.',

  'a) O valor de R$ 000,00 (XXXXX) deverá ser transferido para o PIX (CPNJ) 17.873.416/0001-17, de titularidade de SIMONE NASCIMENTO LIMA SOLUÇÕES IMOBILIARIAS LTDA.',
  '{{honorarios_distribuicao}}',

  'b) O valor de R$6.600,00 (seis mil e seiscentos reais) deverá ser transferido para a conta da XXXXX, agência 000, operação 000, conta XXXX 00-0 ou PIX (XXX) 000000, de titularidade de XXXXXXX.',
  '',

  'Salvador/BA, _____ de de 2026.',
  'Salvador/BA, {{data_extenso}}.',

  'XXXXXXXXXX XXXXXXXXXXXXXXXXX',
  '{{vendedor_1}}{{#vendedor_2}}          {{vendedor_2}}{{/vendedor_2}}',

  'CPF/MF N° 000 CPF/MF Nº 00000',
  'CPF/MF Nº {{vendedor_1_cpf}}{{#vendedor_2}}          CPF/MF Nº {{vendedor_2_cpf}}{{/vendedor_2}}',

  'SIMONE NASCIMENTO SOLUÇÕES IMOBILIÁRIAS XXXXXXXXX',
  '{{#honorarios_imobiliaria}}{{imobiliaria}}          {{/honorarios_imobiliaria}}{{corretor_1}}',

  'CRECI-PJ/BA 1617 CRECI-PF/BA 000000',
  '{{#honorarios_imobiliaria}}CRECI-PJ/BA {{imobiliaria_creci}}          {{/honorarios_imobiliaria}}CRECI-PF/BA {{corretor_1_creci}}',

  'XXXXXXXX',
  '{{#corretor_2}}{{corretor_2}}{{/corretor_2}}',

  'CRECI-PF/BA 0000',
  '{{#corretor_2}}CRECI-PF/BA {{corretor_2_creci}}{{/corretor_2}}'
]);

-- Promessa — escritura (à vista) e financiamento: trechos em comum
-- primeiro, depois os específicos de cada um.
SELECT soma.fn_tmp_atualizar_modelo(nome, ARRAY[
  -- vendedor (escritura)
  'De um lado, XXXXXX, brasileiro, maior, capaz, profissão, nascido em XXX, filiação de XXX, portador da cédula de identidade nº 0000 SSP/BA, inscrito no CPF/MF sob nº 0000, casado sob o regime da XXXX com XXXX, brasileira, maior, capaz, profissão, nascida em XXXX, filiação de XXXX, portadora da cédula de identidade nº 0000 SSP/BA, inscrita no CPF/MF sob nº 0000, ambos residentes e domiciliados em XXXX.',
  'De um lado, {{vendedor_1}}, brasileiro, maior, capaz, {{vendedor_1_profissao}}, nascido em {{vendedor_1_nascimento}}, filiação de XXX, portador da cédula de identidade nº {{vendedor_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{vendedor_1_cpf}}{{#vendedor_2}}{{#vendedor_2_conjuge}}, casado sob o regime da XXXX com {{/vendedor_2_conjuge}}{{#vendedor_2_companheiro}}, convivente em união estável com {{/vendedor_2_companheiro}}{{#vendedor_2_outro}}, e {{/vendedor_2_outro}}{{vendedor_2}}, brasileira, maior, capaz, {{vendedor_2_profissao}}, nascida em {{vendedor_2_nascimento}}, filiação de XXXX, portadora da cédula de identidade nº {{vendedor_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{vendedor_2_cpf}}, ambos residentes e domiciliados em {{vendedor_1_endereco}}{{/vendedor_2}}{{^vendedor_2}}, residente e domiciliado em {{vendedor_1_endereco}}{{/vendedor_2}}.',

  -- vendedor (financiamento)
  'De um lado, XXXXXX, brasileiro, maior, capaz, profissão, nascido em XXX, natural de XXX, filiação de XXX, portador da cédula de identidade nº 0000 SSP/BA, inscrito no CPF/MF sob nº 0000, casado sob o regime da XXXX com XXXX, brasileira, maior, capaz, profissão, nascida em XXXX, natural de XXX, filiação de XXXX, portadora da cédula de identidade nº 0000 SSP/BA, inscrita no CPF/MF sob nº 0000, ambos residentes e domiciliados na XXXX.',
  'De um lado, {{vendedor_1}}, brasileiro, maior, capaz, {{vendedor_1_profissao}}, nascido em {{vendedor_1_nascimento}}, natural de XXX, filiação de XXX, portador da cédula de identidade nº {{vendedor_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{vendedor_1_cpf}}{{#vendedor_2}}{{#vendedor_2_conjuge}}, casado sob o regime da XXXX com {{/vendedor_2_conjuge}}{{#vendedor_2_companheiro}}, convivente em união estável com {{/vendedor_2_companheiro}}{{#vendedor_2_outro}}, e {{/vendedor_2_outro}}{{vendedor_2}}, brasileira, maior, capaz, {{vendedor_2_profissao}}, nascida em {{vendedor_2_nascimento}}, natural de XXX, filiação de XXXX, portadora da cédula de identidade nº {{vendedor_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{vendedor_2_cpf}}, ambos residentes e domiciliados na {{vendedor_1_endereco}}{{/vendedor_2}}{{^vendedor_2}}, residente e domiciliado na {{vendedor_1_endereco}}{{/vendedor_2}}.',

  -- comprador (escritura)
  'De outro lado, XXXX, brasileiro, maior, capaz, profissão, solteira e declara não conviver em união estável, nascido em 0000, filiação de xxxx, portador da cédula de identidade nº xxx SSP/BA, inscrito no CPF/MF sob nº xxxx, residente e domiciliado em xxxx.',
  'De outro lado, {{comprador_1}}, brasileiro, maior, capaz, {{comprador_1_profissao}}, {{^comprador_2}}solteira e declara não conviver em união estável, {{/comprador_2}}nascido em {{comprador_1_nascimento}}, filiação de xxxx, portador da cédula de identidade nº {{comprador_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{comprador_1_cpf}}{{#comprador_2}}{{#comprador_2_conjuge}}, casado sob o regime da XXXX com {{/comprador_2_conjuge}}{{#comprador_2_companheiro}}, convivente em união estável com {{/comprador_2_companheiro}}{{#comprador_2_outro}}, e {{/comprador_2_outro}}{{comprador_2}}, brasileira, maior, capaz, {{comprador_2_profissao}}, nascida em {{comprador_2_nascimento}}, filiação de xxxx, portadora da cédula de identidade nº {{comprador_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{comprador_2_cpf}}, ambos residentes e domiciliados em {{comprador_1_endereco}}{{/comprador_2}}{{^comprador_2}}, residente e domiciliado em {{comprador_1_endereco}}{{/comprador_2}}.',

  -- comprador (financiamento)
  'De outro lado, XXXX, brasileiro, maior, capaz, profissão, solteiro e declara não conviver em união estável, nascido em 0000, natural de XX, filiação de xxxx, portador da cédula de identidade nº xxx SSP/BA, inscrito no CPF/MF sob nº xxxx, residente e domiciliado na xxxx.',
  'De outro lado, {{comprador_1}}, brasileiro, maior, capaz, {{comprador_1_profissao}}, {{^comprador_2}}solteiro e declara não conviver em união estável, {{/comprador_2}}nascido em {{comprador_1_nascimento}}, natural de XX, filiação de xxxx, portador da cédula de identidade nº {{comprador_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{comprador_1_cpf}}{{#comprador_2}}{{#comprador_2_conjuge}}, casado sob o regime da XXXX com {{/comprador_2_conjuge}}{{#comprador_2_companheiro}}, convivente em união estável com {{/comprador_2_companheiro}}{{#comprador_2_outro}}, e {{/comprador_2_outro}}{{comprador_2}}, brasileira, maior, capaz, {{comprador_2_profissao}}, nascida em {{comprador_2_nascimento}}, natural de XX, filiação de xxxx, portadora da cédula de identidade nº {{comprador_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{comprador_2_cpf}}, ambos residentes e domiciliados na {{comprador_1_endereco}}{{/comprador_2}}{{^comprador_2}}, residente e domiciliado na {{comprador_1_endereco}}{{/comprador_2}}.',

  -- imóvel
  'conforme descrito na matrícula nº XXX do 0º Cartório de Registro de Imóveis de Salvador/BA.',
  'conforme descrito na matrícula nº {{imovel_matricula}} do {{imovel_cartorio_numero}} Cartório de Registro de Imóveis de {{imovel_cartorio_cidade}}/BA.',

  '2.1 - Endereço (IPTU): XXXXX',
  '2.1 - Endereço (IPTU):',
  '2.1 - Endereço (IPTU):',
  '2.1 - Endereço (IPTU): {{imovel_endereco}}{{#imovel_iptu}} — inscrição municipal nº {{imovel_iptu}}{{/imovel_iptu}}',

  -- preço total + conta do vendedor
  'o preço total de R$ 000.000,00 (xxx), por meio de transferência bancária para a conta do BANCO XXX, AGÊNCIA 000, CONTA XX 00-0 de titularidade do PROMITENTE VENDEDOR, da seguinte forma:',
  'o preço total de {{imovel_valor}} ({{imovel_valor_extenso}}), por meio de transferência bancária para a conta {{vendedor_1_conta}} de titularidade do PROMITENTE VENDEDOR, da seguinte forma:',
  'o preço total de R$ 000.000,00 (xxx), por meio de transferência bancária para a conta do BANCO XXX, AGÊNCIA 000, CONTA CORRENTE 00-0 de titularidade do PROMITENTE VENDEDOR, da seguinte forma:',
  'o preço total de {{imovel_valor}} ({{imovel_valor_extenso}}), por meio de transferência bancária para a conta {{vendedor_1_conta}} de titularidade do PROMITENTE VENDEDOR, da seguinte forma:',

  -- parcelas (escritura): sinal + saldo na escritura (+ entrada, se houver)
  'R$ 000.000,00 (xxx) a título de sinal em favor do PROMITENTE VENDEDOR',
  '{{imovel_sinal}} ({{imovel_sinal_extenso}}) a título de sinal em favor do PROMITENTE VENDEDOR',
  'R$ 000.000,00 (xxx) em favor do PROMITENTE VENDEDOR, por meio de transferência bancária, no ato da assinatura da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas de Salvador/BA.',
  '{{#imovel_entrada}}{{imovel_entrada}} ({{imovel_entrada_extenso}}) a título de entrada em favor do PROMITENTE VENDEDOR, por meio de transferência bancária, em __________. {{/imovel_entrada}}{{imovel_saldo_quitacao}} ({{imovel_saldo_quitacao_extenso}}) em favor do PROMITENTE VENDEDOR, por meio de transferência bancária, no ato da assinatura da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas de Salvador/BA.',

  -- parcelas (financiamento)
  'R$ 00.000,00 (xxxx reais) a título de sinal em favor do PROMITENTE VENDEDOR',
  '{{imovel_sinal}} ({{imovel_sinal_extenso}}) a título de sinal em favor do PROMITENTE VENDEDOR',
  'R$ 00.000,00 (xxxx reais) a título de entrada em favor do PROMITENTE VENDEDOR',
  '{{imovel_entrada}} ({{imovel_entrada_extenso}}) a título de entrada em favor do PROMITENTE VENDEDOR',
  'R$ 00.000,00 (xxxx reais) que será liquidada pelo PROMITENTE COMPRADOR, através de financiamento e FGTS intermediado pelo agente financeiro bancário',
  '{{imovel_financiamento}} ({{imovel_financiamento_extenso}}) que será liquidada pelo PROMITENTE COMPRADOR, através de financiamento{{#imovel_usa_fgts}} e FGTS{{/imovel_usa_fgts}} intermediado pelo agente financeiro bancário',

  -- preço total repetido nas cláusulas
  '(R$000.000,00)', '({{imovel_valor}})',
  '(R$ 000.000,00)', '({{imovel_valor}})',

  -- corretagem (4.2)
  'conforme estipulado em contrato de honorários de corretagem firmado com os profissionais abaixo qualificados: SIMONE NASCIMENTO LIMA SOLUÇÕES IMOBILIARIAS LTDA, pessoa jurídica, inscrita regularmente no CRECI-PJ/BA nº 1.617, CNPJ sob nº 17.873.416/0001-17, com sede na Rua dos Colibris, nº79, Edifício Empresarial Paralela Place, Sala 603, Imbuí, Salvador/BA, CEP 41.720-060 e XXXXXX, brasileira, maior, capaz, corretora de imóveis, regularmente inscrita no CRECI-PF/BA 0000, CPF/MF sob nº 0000, residente e domiciliada nesta Capital.',
  'conforme estipulado em contrato de honorários de corretagem firmado com os profissionais abaixo qualificados: {{#honorarios_imobiliaria}}{{imobiliaria}}, pessoa jurídica, inscrita regularmente no CRECI-PJ/BA nº {{imobiliaria_creci}}, CNPJ sob nº {{imobiliaria_cnpj}}, com sede na {{imobiliaria_endereco}} e {{/honorarios_imobiliaria}}{{corretor_1}}, brasileira, maior, capaz, corretora de imóveis, regularmente inscrita no CRECI-PF/BA {{corretor_1_creci}}, CPF/MF sob nº {{corretor_1_cpf}}, residente e domiciliada nesta Capital{{#corretor_2}}, e {{corretor_2}}, brasileira, maior, capaz, corretora de imóveis, regularmente inscrita no CRECI-PF/BA {{corretor_2_creci}}, CPF/MF sob nº {{corretor_2_cpf}}, residente e domiciliada nesta Capital{{/corretor_2}}.',

  -- o que fica no imóvel: uma das duas redações do 7.1
  '7.1 - Permanecendo no imóvel: xxxxxxxxx',
  '{{#imovel_itens}}7.1 - Permanecendo no imóvel: {{imovel_itens}}{{/imovel_itens}}',
  '7.1 - O imóvel será entregue ao PROMITENTE COMPRADOR completamente vazio e desocupado, não permanecendo no local quaisquer bens de propriedade do PROMITENTE VENDEDOR.',
  '{{^imovel_itens}}7.1 - O imóvel será entregue ao PROMITENTE COMPRADOR completamente vazio e desocupado, não permanecendo no local quaisquer bens de propriedade do PROMITENTE VENDEDOR.{{/imovel_itens}}',

  -- cartório no protocolo de registro
  'emitido pelo 0º Ofício de Registro de Imóveis de Salvador/BA.',
  'emitido pelo {{imovel_cartorio}}.',

  -- data e assinaturas
  'Salvador/BA, ______ de de 2026.',
  'Salvador/BA, {{data_extenso}}.',
  'XXXXXXXXXX XXXXXXXXXXXXX CPF/MF Nº 000000000000000 CPF/MF N° 000000000',
  '{{vendedor_1}} — CPF/MF Nº {{vendedor_1_cpf}}{{#vendedor_2}}          {{vendedor_2}} — CPF/MF Nº {{vendedor_2_cpf}}{{/vendedor_2}}',
  'XXXXXXXX',
  '{{comprador_1}}{{#comprador_2}}          {{comprador_2}}{{/comprador_2}}',
  'CPF/MF Nº 000000000',
  'CPF/MF Nº {{comprador_1_cpf}}{{#comprador_2}}          CPF/MF Nº {{comprador_2_cpf}}{{/comprador_2}}'
])
FROM (VALUES
  ('Promessa de compra e venda — particular (escritura)'),
  ('Promessa de compra e venda — particular (financiamento)')
) AS m(nome);

DROP FUNCTION soma.fn_tmp_atualizar_modelo(TEXT, TEXT[]);
