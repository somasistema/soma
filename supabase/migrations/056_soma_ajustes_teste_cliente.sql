-- ================================================================
-- SOMA — Migration 056
-- Ajustes do teste do cliente (processo SOMA-2026-0008):
--
--   1) Corrige "fn_render_modelo_contrato(uuid, uuid) is not unique":
--      a versão de 2 parâmetros (047) voltou a existir ao lado da de 3
--      (052). Dropa a de 2 e recria a de 3, agora puxando os dados do
--      negócio (partes, imóvel, honorários, corretores) + valor por
--      extenso.
--   2) Cadastro de corretores (soma.corretores). Corretor digitado nos
--      honorários entra no cadastro sozinho e vira parte do processo
--      (papel "corretor") — não precisa mais lançar duas vezes.
--   3) Honorários em percentual: total como % do valor do imóvel;
--      imobiliária e cada corretor com valor e % dos honorários.
--   4) Imóvel ganha endereço, matrícula e inscrição do IPTU.
--   5) Checklist de documentos ganha "IPTU do imóvel" e passa a aceitar
--      mais de um arquivo por item (frente e verso).
--   6) Documento enviado já entra como validado — rejeitar continua
--      possível. A conferência do OCR vira um relatório à parte.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Cadastro de corretores
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS soma.corretores (
  cd_corretor UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nm_corretor VARCHAR(255) NOT NULL,
  ds_cpf VARCHAR(20),
  ds_creci VARCHAR(40),
  ds_telefone VARCHAR(30),
  ds_email VARCHAR(255),
  ds_pix VARCHAR(255),
  ds_conta_bancaria VARCHAR(255),
  sn_ativo BOOLEAN DEFAULT true NOT NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_corretores_nome ON soma.corretores (lower(nm_corretor));

ALTER TABLE soma.corretores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "corretores_select" ON soma.corretores;
CREATE POLICY "corretores_select" ON soma.corretores FOR SELECT
  USING (soma.fn_auth_role() IN ('master', 'juridico', 'gerente', 'despachante'));

DROP POLICY IF EXISTS "corretores_insert" ON soma.corretores;
CREATE POLICY "corretores_insert" ON soma.corretores FOR INSERT
  WITH CHECK (soma.fn_auth_role() IN ('master', 'juridico'));

DROP POLICY IF EXISTS "corretores_update" ON soma.corretores;
CREATE POLICY "corretores_update" ON soma.corretores FOR UPDATE
  USING (soma.fn_auth_role() IN ('master', 'juridico'));

DROP POLICY IF EXISTS "corretores_delete" ON soma.corretores;
CREATE POLICY "corretores_delete" ON soma.corretores FOR DELETE
  USING (soma.fn_auth_role() IN ('master', 'juridico'));

DROP TRIGGER IF EXISTS trg_auditoria ON soma.corretores;
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.corretores
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_corretor');

-- ----------------------------------------------------------------
-- 2) Colunas novas do negócio
-- ----------------------------------------------------------------
ALTER TABLE soma.processo_negocio
  ADD COLUMN IF NOT EXISTS ds_imovel_endereco TEXT,
  ADD COLUMN IF NOT EXISTS ds_imovel_matricula VARCHAR(60),
  ADD COLUMN IF NOT EXISTS ds_imovel_iptu VARCHAR(60),
  -- % do valor do imóvel
  ADD COLUMN IF NOT EXISTS pc_honorarios_total NUMERIC(6, 2),
  -- % do total dos honorários
  ADD COLUMN IF NOT EXISTS pc_honorarios_imobiliaria NUMERIC(6, 2);

ALTER TABLE soma.processo_corretor
  ADD COLUMN IF NOT EXISTS cd_corretor UUID REFERENCES soma.corretores(cd_corretor) ON DELETE SET NULL,
  -- % do total dos honorários
  ADD COLUMN IF NOT EXISTS pc_honorario NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS nr_ordem INTEGER NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------
-- 3) Checklist: categoria IPTU + vários arquivos por item
-- ----------------------------------------------------------------
ALTER TABLE soma.documentos
  DROP CONSTRAINT IF EXISTS documentos_tp_categoria_intake_check;

ALTER TABLE soma.documentos
  ADD CONSTRAINT documentos_tp_categoria_intake_check CHECK (tp_categoria_intake IN (
    'identidade', 'estado_civil', 'comprovante_residencia', 'onus_escritura', 'iptu'
  ));

-- ----------------------------------------------------------------
-- 4) Documento novo já entra validado
-- ----------------------------------------------------------------
ALTER TABLE soma.documentos ALTER COLUMN tp_status SET DEFAULT 'validado';

-- ----------------------------------------------------------------
-- 5) Helpers de formatação (usados no render da minuta)
-- ----------------------------------------------------------------

-- 0..999 por extenso.
CREATE OR REPLACE FUNCTION soma.fn_extenso_centena(p_n INTEGER)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = soma, public AS $$
DECLARE
  v_unidades TEXT[] := ARRAY['um','dois','três','quatro','cinco','seis','sete','oito','nove'];
  v_dez_a_dezenove TEXT[] := ARRAY['dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
  v_dezenas TEXT[] := ARRAY['','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
  v_centenas TEXT[] := ARRAY['cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
  v_c INTEGER := p_n / 100;
  v_resto INTEGER := p_n % 100;
  v_partes TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_n = 0 THEN
    RETURN '';
  END IF;
  IF p_n = 100 THEN
    RETURN 'cem';
  END IF;

  IF v_c > 0 THEN
    v_partes := v_partes || v_centenas[v_c];
  END IF;

  IF v_resto >= 10 AND v_resto <= 19 THEN
    v_partes := v_partes || v_dez_a_dezenove[v_resto - 9];
  ELSE
    IF v_resto >= 20 THEN
      v_partes := v_partes || v_dezenas[v_resto / 10];
    END IF;
    IF v_resto % 10 > 0 THEN
      v_partes := v_partes || v_unidades[v_resto % 10];
    END IF;
  END IF;

  RETURN array_to_string(v_partes, ' e ');
END;
$$;

-- Número inteiro por extenso (até centenas de bilhões), no padrão dos
-- contratos da SOMA: "nove mil, seiscentos e vinte e cinco".
CREATE OR REPLACE FUNCTION soma.fn_extenso_inteiro(p_n BIGINT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = soma, public AS $$
DECLARE
  v_grupos INTEGER[] := ARRAY[
    ((p_n / 1000000000) % 1000)::int,
    ((p_n / 1000000) % 1000)::int,
    ((p_n / 1000) % 1000)::int,
    (p_n % 1000)::int
  ];
  v_textos TEXT[] := ARRAY[]::TEXT[];
  v_valores INTEGER[] := ARRAY[]::INTEGER[];
  v_txt TEXT;
  v_resultado TEXT := '';
  i INTEGER;
BEGIN
  IF p_n = 0 THEN
    RETURN 'zero';
  END IF;

  FOR i IN 1..4 LOOP
    CONTINUE WHEN v_grupos[i] = 0;
    v_txt := CASE i
      WHEN 1 THEN CASE WHEN v_grupos[i] = 1 THEN 'um bilhão' ELSE soma.fn_extenso_centena(v_grupos[i]) || ' bilhões' END
      WHEN 2 THEN CASE WHEN v_grupos[i] = 1 THEN 'um milhão' ELSE soma.fn_extenso_centena(v_grupos[i]) || ' milhões' END
      WHEN 3 THEN CASE WHEN v_grupos[i] = 1 THEN 'mil' ELSE soma.fn_extenso_centena(v_grupos[i]) || ' mil' END
      ELSE soma.fn_extenso_centena(v_grupos[i])
    END;
    v_textos := v_textos || v_txt;
    v_valores := v_valores || v_grupos[i];
  END LOOP;

  FOR i IN 1..array_length(v_textos, 1) LOOP
    IF i = 1 THEN
      v_resultado := v_textos[i];
    -- "e" antes do último grupo quando ele é redondo ou < 100
    -- ("mil e quinhentos", "mil e vinte"); senão, vírgula.
    ELSIF i = array_length(v_textos, 1) AND (v_valores[i] < 100 OR v_valores[i] % 100 = 0) THEN
      v_resultado := v_resultado || ' e ' || v_textos[i];
    ELSE
      v_resultado := v_resultado || ', ' || v_textos[i];
    END IF;
  END LOOP;

  RETURN v_resultado;
END;
$$;

-- Valor em reais por extenso: 3937.50 -> "três mil, novecentos e
-- trinta e sete reais e cinquenta centavos".
CREATE OR REPLACE FUNCTION soma.fn_valor_extenso(p_valor NUMERIC)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE SET search_path = soma, public AS $$
DECLARE
  v_inteiro BIGINT;
  v_centavos INTEGER;
  v_txt TEXT := '';
BEGIN
  IF p_valor IS NULL THEN
    RETURN NULL;
  END IF;

  v_inteiro := trunc(abs(p_valor))::bigint;
  v_centavos := round((abs(p_valor) - trunc(abs(p_valor))) * 100)::int;
  IF v_centavos = 100 THEN
    v_inteiro := v_inteiro + 1;
    v_centavos := 0;
  END IF;

  IF v_inteiro = 0 AND v_centavos = 0 THEN
    RETURN 'zero reais';
  END IF;

  IF v_inteiro > 0 THEN
    v_txt := soma.fn_extenso_inteiro(v_inteiro);
    -- "um milhão de reais", "dois bilhões de reais"
    IF v_inteiro >= 1000000 AND v_inteiro % 1000000 = 0 THEN
      v_txt := v_txt || ' de';
    END IF;
    v_txt := v_txt || CASE WHEN v_inteiro = 1 THEN ' real' ELSE ' reais' END;
  END IF;

  IF v_centavos > 0 THEN
    IF v_inteiro > 0 THEN
      v_txt := v_txt || ' e ';
    END IF;
    v_txt := v_txt || soma.fn_extenso_inteiro(v_centavos)
      || CASE WHEN v_centavos = 1 THEN ' centavo' ELSE ' centavos' END;
  END IF;

  RETURN v_txt;
END;
$$;

-- R$ 1.234,56 (não depende do locale do banco).
CREATE OR REPLACE FUNCTION soma.fn_formatar_moeda(p_valor NUMERIC)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = soma, public AS $$
  SELECT CASE WHEN p_valor IS NULL THEN NULL ELSE
    'R$ ' || translate(to_char(p_valor, 'FM999,999,999,990.00'), ',.', '.,')
  END;
$$;

-- 5 -> "5%", 22.5 -> "22,5%".
CREATE OR REPLACE FUNCTION soma.fn_formatar_percentual(p_valor NUMERIC)
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = soma, public AS $$
  SELECT CASE WHEN p_valor IS NULL THEN NULL ELSE
    replace(rtrim(rtrim(to_char(p_valor, 'FM9990.00'), '0'), '.'), '.', ',') || '%'
  END;
$$;

-- ["A"] -> "A"; ["A","B"] -> "A e B"; ["A","B","C"] -> "A, B e C".
CREATE OR REPLACE FUNCTION soma.fn_juntar_nomes(p_nomes TEXT[])
RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = soma, public AS $$
  SELECT CASE
    WHEN p_nomes IS NULL OR cardinality(p_nomes) = 0 THEN NULL
    WHEN cardinality(p_nomes) = 1 THEN p_nomes[1]
    ELSE array_to_string(p_nomes[1:cardinality(p_nomes) - 1], ', ') || ' e ' || p_nomes[cardinality(p_nomes)]
  END;
$$;

-- Melhor valor lido pelo OCR para um campo, nos documentos de uma
-- parte (prefere o conferido à mão, depois o de maior confiança).
-- Sem SECURITY DEFINER de propósito: chamada direta respeita a RLS do
-- OCR; dentro do render (que é DEFINER) já roda com o dono.
CREATE OR REPLACE FUNCTION soma.fn_campo_ocr_da_parte(p_cd_parte UUID, p_nm_campo TEXT)
RETURNS TEXT
LANGUAGE sql STABLE SET search_path = soma, public AS $$
  SELECT c.ds_valor
  FROM soma.documento_ocr_campos c
  JOIN soma.documento_ocr o ON o.cd_documento_ocr = c.cd_documento_ocr
  JOIN soma.documentos d ON d.cd_documento = o.cd_documento
  WHERE d.cd_parte = p_cd_parte
    AND c.nm_campo = p_nm_campo
    AND d.tp_status <> 'rejeitado'
  ORDER BY c.sn_confirmado DESC, c.nr_confianca DESC NULLS LAST
  LIMIT 1;
$$;

-- ----------------------------------------------------------------
-- 6) fn_render_modelo_contrato — corrige a ambiguidade e passa a
--    preencher os dados do negócio.
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS soma.fn_render_modelo_contrato(UUID, UUID);

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
  v_conteudo TEXT;
  v_campos JSONB := '{}'::jsonb;
  v_chave TEXT;
  v_valor TEXT;
  v_lado TEXT;
  v_i INTEGER;
  v_nomes TEXT[];
  v_fallback TEXT;
  v_imobiliaria soma.imobiliarias%ROWTYPE;
  v_mes TEXT;
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
    'imobiliaria_cnpj', v_imobiliaria.ds_cnpj
  );

  -- Vendedores e compradores (todos juntos + um por um) ----------
  FOREACH v_lado IN ARRAY ARRAY['vendedor', 'comprador'] LOOP
    v_i := 0;
    v_nomes := ARRAY[]::TEXT[];
    FOR r IN
      SELECT * FROM soma.processo_parte
      WHERE cd_processo = p_cd_processo AND tp_lado = v_lado
      ORDER BY nr_ordem, nm_parte
    LOOP
      v_i := v_i + 1;
      v_nomes := v_nomes || r.nm_parte;
      v_campos := v_campos || jsonb_build_object(
        v_lado || '_' || v_i, r.nm_parte,
        v_lado || '_' || v_i || '_profissao', r.ds_profissao,
        v_lado || '_' || v_i || '_telefone', r.ds_telefone,
        v_lado || '_' || v_i || '_email', r.ds_email,
        v_lado || '_' || v_i || '_conta', r.ds_conta_bancaria,
        v_lado || '_' || v_i || '_cpf', soma.fn_campo_ocr_da_parte(r.cd_parte, 'cpf'),
        v_lado || '_' || v_i || '_rg', soma.fn_campo_ocr_da_parte(r.cd_parte, 'rg'),
        v_lado || '_' || v_i || '_nascimento', soma.fn_campo_ocr_da_parte(r.cd_parte, 'data_nascimento')
      );
    END LOOP;

    -- Processo sem questionário: cai no usuário vinculado (como antes).
    v_fallback := NULL;
    IF cardinality(v_nomes) = 0 THEN
      IF v_lado = 'vendedor' THEN
        SELECT nm_usuario INTO v_fallback FROM soma.usuarios WHERE cd_usuario = v_processo.cd_vendedor;
      ELSE
        SELECT nm_usuario INTO v_fallback FROM soma.usuarios WHERE cd_usuario = v_processo.cd_comprador;
        v_fallback := COALESCE(v_fallback, v_processo.nm_comprador_convidado);
      END IF;
    END IF;

    v_campos := v_campos || jsonb_build_object(
      v_lado, COALESCE(soma.fn_juntar_nomes(v_nomes), v_fallback)
    );
  END LOOP;

  -- Imóvel -------------------------------------------------------
  v_campos := v_campos || jsonb_build_object(
    'imovel_endereco', v_negocio.ds_imovel_endereco,
    'imovel_matricula', v_negocio.ds_imovel_matricula,
    'imovel_iptu', v_negocio.ds_imovel_iptu,
    'imovel_valor', soma.fn_formatar_moeda(v_negocio.vl_imovel),
    'imovel_valor_extenso', soma.fn_valor_extenso(v_negocio.vl_imovel),
    'imovel_entrada', soma.fn_formatar_moeda(v_negocio.vl_entrada),
    'imovel_entrada_extenso', soma.fn_valor_extenso(v_negocio.vl_entrada),
    'imovel_financiamento', soma.fn_formatar_moeda(v_negocio.vl_financiamento),
    'imovel_financiamento_extenso', soma.fn_valor_extenso(v_negocio.vl_financiamento),
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
    'honorarios_imobiliaria', soma.fn_formatar_moeda(v_negocio.vl_honorarios_imobiliaria),
    'honorarios_imobiliaria_extenso', soma.fn_valor_extenso(v_negocio.vl_honorarios_imobiliaria),
    'honorarios_imobiliaria_percentual', soma.fn_formatar_percentual(v_negocio.pc_honorarios_imobiliaria)
  );

  IF v_negocio.vl_honorarios_imobiliaria IS NOT NULL THEN
    v_letra := v_letra + 1;
    v_distribuicao := v_distribuicao || (
      chr(96 + v_letra) || ') ' || soma.fn_formatar_moeda(v_negocio.vl_honorarios_imobiliaria)
      || ' (' || soma.fn_valor_extenso(v_negocio.vl_honorarios_imobiliaria) || ') para '
      || COALESCE(v_imobiliaria.nm_imobiliaria, v_vazio)
      || COALESCE(', CNPJ ' || v_imobiliaria.ds_cnpj, '') || ';'
    );
  END IF;

  -- Corretores (honorários + cadastro) ---------------------------
  v_i := 0;
  v_nomes := ARRAY[]::TEXT[];
  FOR r IN
    SELECT pc.nm_corretor, pc.vl_honorario, pc.pc_honorario,
           c.ds_cpf, c.ds_creci, c.ds_pix, c.ds_telefone, c.ds_email, c.ds_conta_bancaria
    FROM soma.processo_corretor pc
    LEFT JOIN soma.corretores c ON c.cd_corretor = pc.cd_corretor
    WHERE pc.cd_processo = p_cd_processo
    ORDER BY pc.nr_ordem, pc.nm_corretor
  LOOP
    v_i := v_i + 1;
    v_nomes := v_nomes || r.nm_corretor;
    v_campos := v_campos || jsonb_build_object(
      'corretor_' || v_i, r.nm_corretor,
      'corretor_' || v_i || '_honorario', soma.fn_formatar_moeda(r.vl_honorario),
      'corretor_' || v_i || '_honorario_extenso', soma.fn_valor_extenso(r.vl_honorario),
      'corretor_' || v_i || '_percentual', soma.fn_formatar_percentual(r.pc_honorario),
      'corretor_' || v_i || '_cpf', r.ds_cpf,
      'corretor_' || v_i || '_creci', r.ds_creci,
      'corretor_' || v_i || '_pix', r.ds_pix,
      'corretor_' || v_i || '_telefone', r.ds_telefone,
      'corretor_' || v_i || '_email', r.ds_email,
      'corretor_' || v_i || '_conta', r.ds_conta_bancaria
    );

    IF r.vl_honorario IS NOT NULL THEN
      v_letra := v_letra + 1;
      v_distribuicao := v_distribuicao || (
        chr(96 + v_letra) || ') ' || soma.fn_formatar_moeda(r.vl_honorario)
        || ' (' || soma.fn_valor_extenso(r.vl_honorario) || ') para ' || r.nm_corretor
        || COALESCE(', CPF ' || r.ds_cpf, '')
        || COALESCE(', PIX ' || r.ds_pix, '') || ';'
      );
    END IF;
  END LOOP;

  v_fallback := NULL;
  IF cardinality(v_nomes) = 0 THEN
    SELECT nm_usuario INTO v_fallback FROM soma.usuarios WHERE cd_usuario = v_processo.cd_corretor;
  END IF;

  v_campos := v_campos || jsonb_build_object(
    'corretor', COALESCE(soma.fn_juntar_nomes(v_nomes), v_fallback),
    'honorarios_distribuicao', NULLIF(array_to_string(v_distribuicao, E'\n'), '')
  );

  -- Substituição -------------------------------------------------
  FOR v_chave, v_valor IN SELECT key, value FROM jsonb_each_text(v_campos) LOOP
    v_conteudo := replace(
      v_conteudo,
      '{{' || v_chave || '}}',
      v_ini || COALESCE(NULLIF(trim(v_valor), ''), v_vazio) || v_fim
    );
  END LOOP;

  -- Índice sem parte correspondente (ex: {{vendedor_2}} num processo
  -- com um vendedor só) vira lacuna a preencher à mão.
  v_conteudo := regexp_replace(
    v_conteudo,
    '\{\{(vendedor|comprador|corretor)_[0-9]+(_[a-z_]+)?\}\}',
    v_ini || v_vazio || v_fim,
    'g'
  );

  RETURN v_conteudo;
END;
$$;

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
    soma.fn_render_modelo_contrato(p_cd_processo, p_cd_modelo, false)
  );
END;
$$;

-- ----------------------------------------------------------------
-- 7) fn_salvar_dados_negocio — campos novos + cadastro de corretores
--    + corretor vira parte do processo automaticamente.
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
    ds_imovel_endereco, ds_imovel_matricula, ds_imovel_iptu,
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
    vl_honorarios_total = EXCLUDED.vl_honorarios_total,
    pc_honorarios_total = EXCLUDED.pc_honorarios_total,
    ds_honorarios_quando = EXCLUDED.ds_honorarios_quando,
    vl_honorarios_imobiliaria = EXCLUDED.vl_honorarios_imobiliaria,
    pc_honorarios_imobiliaria = EXCLUDED.pc_honorarios_imobiliaria,
    ts_atualizacao = now();

  DELETE FROM soma.processo_parte WHERE cd_processo = p_cd_processo;
  INSERT INTO soma.processo_parte (
    cd_processo, tp_lado, nr_ordem, nm_parte, ds_telefone, ds_email,
    ds_profissao, ds_conta_bancaria, ds_documentos_obs
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
    NULLIF(parte->>'ds_documentos_obs', '')
  FROM jsonb_array_elements(COALESCE(p_partes, '[]'::jsonb)) AS parte
  WHERE NULLIF(trim(parte->>'nm_parte'), '') IS NOT NULL;

  DELETE FROM soma.processo_corretor WHERE cd_processo = p_cd_processo;

  FOR v_corretor, v_ordem IN
    SELECT value, ordinality
    FROM jsonb_array_elements(COALESCE(p_corretores, '[]'::jsonb)) WITH ORDINALITY
  LOOP
    v_nome := NULLIF(trim(v_corretor->>'nm_corretor'), '');
    CONTINUE WHEN v_nome IS NULL;

    -- Liga ao cadastro: pelo id escolhido na tela, senão pelo nome;
    -- se não existir, cadastra.
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
        nm_corretor, ds_cpf, ds_creci, ds_telefone, ds_email, ds_pix
      )
      VALUES (
        v_nome,
        NULLIF(trim(v_corretor->>'ds_cpf'), ''),
        NULLIF(trim(v_corretor->>'ds_creci'), ''),
        NULLIF(trim(v_corretor->>'ds_telefone'), ''),
        NULLIF(trim(v_corretor->>'ds_email'), ''),
        NULLIF(trim(v_corretor->>'ds_pix'), '')
      )
      RETURNING cd_corretor INTO v_cd_corretor;
    ELSE
      -- Só completa o que estiver vazio no cadastro; nunca sobrescreve.
      UPDATE soma.corretores SET
        ds_cpf = COALESCE(ds_cpf, NULLIF(trim(v_corretor->>'ds_cpf'), '')),
        ds_creci = COALESCE(ds_creci, NULLIF(trim(v_corretor->>'ds_creci'), '')),
        ds_telefone = COALESCE(ds_telefone, NULLIF(trim(v_corretor->>'ds_telefone'), '')),
        ds_email = COALESCE(ds_email, NULLIF(trim(v_corretor->>'ds_email'), '')),
        ds_pix = COALESCE(ds_pix, NULLIF(trim(v_corretor->>'ds_pix'), ''))
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

    -- Corretor dos honorários também é parte do processo (link próprio,
    -- documentos) — a não ser que já tenha vindo nas "outras partes".
    IF NOT EXISTS (
      SELECT 1 FROM soma.processo_parte
      WHERE cd_processo = p_cd_processo
        AND tp_lado = 'corretor'
        AND lower(trim(nm_parte)) = lower(v_nome)
    ) THEN
      INSERT INTO soma.processo_parte (
        cd_processo, tp_lado, nr_ordem, nm_parte, ds_telefone, ds_email
      )
      VALUES (
        p_cd_processo, 'corretor', v_ordem::int, v_nome, v_cad.ds_telefone, v_cad.ds_email
      );
    END IF;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------
-- 8) Autoatendimento da parte: vários arquivos por item + remover
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
        'cd_documento', d.cd_documento,
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
    'identidade', 'estado_civil', 'comprovante_residencia', 'onus_escritura', 'iptu'
  ) THEN
    RAISE EXCEPTION 'Categoria de documento inválida.';
  END IF;

  v_perfil := CASE
    WHEN v_parte.tp_lado IN ('vendedor', 'comprador')
      THEN v_parte.tp_lado::soma.type_perfil_documento
    ELSE 'outro'
  END;

  -- Vários arquivos por item (frente e verso): não substitui mais.
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

-- A parte remove um arquivo que ela mesma mandou errado. Devolve o
-- caminho no Storage pra aplicação apagar o arquivo.
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
    RAISE EXCEPTION 'Link inválido.';
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
