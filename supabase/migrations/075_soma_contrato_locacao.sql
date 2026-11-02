-- ================================================================
-- SOMA — Migration 075
-- Contrato de LOCAÇÃO (aluguel) ao lado do de venda.
--
--   * processos.tp_contrato: 'venda' (padrão) ou 'locacao'. Na locação o
--     locador é gravado como "vendedor" e o locatário como "comprador" — só
--     os rótulos e o texto mudam; links, documentos, minuta e assinatura
--     seguem o mesmo caminho.
--   * soma.processo_locacao: prazo, valores (aluguel, condomínio, IPTU),
--     vencimento, água, seguro-incêndio, garantia (caução de 1 a 3 aluguéis,
--     com ou sem taxas), PIX/titular, pintura e vistoria.
--   * fn_salvar_dados_locacao grava isso e marca o processo como locação.
--   * fn_campos_locacao monta os {{locacao_*}} usados no modelo.
--   * fn_render_modelo_contrato (070) passa a incluir esses campos.
--   * fn_registrar_minuta: na locação, as frentes que aprovam são locador,
--     locatário e jurídico — mais corretor e imobiliária só se o processo
--     tem corretor / imobiliária.
--   * fn_parte_processo_por_token (074) devolve tp_contrato (a tela do
--     cliente muda os rótulos e a lista de documentos).
--   * Modelo "Contrato de locação residencial — caução" (a partir de um
--     contrato real da SOMA).
--
-- Rodar depois da 074.
-- ================================================================

ALTER TABLE soma.processos
  ADD COLUMN IF NOT EXISTS tp_contrato VARCHAR(10) NOT NULL DEFAULT 'venda';
ALTER TABLE soma.processos DROP CONSTRAINT IF EXISTS processos_tp_contrato_check;
ALTER TABLE soma.processos ADD CONSTRAINT processos_tp_contrato_check
  CHECK (tp_contrato IN ('venda', 'locacao'));

CREATE TABLE IF NOT EXISTS soma.processo_locacao (
  cd_processo UUID PRIMARY KEY REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  vl_aluguel NUMERIC(15, 2),                 -- aluguel puro, sem taxas
  vl_condominio NUMERIC(15, 2),
  vl_iptu NUMERIC(15, 2),
  nr_prazo_meses INTEGER CHECK (nr_prazo_meses IS NULL OR nr_prazo_meses > 0),
  dt_inicio DATE,
  dt_entrega_chaves DATE,                    -- em branco = a data de início
  nr_dia_vencimento INTEGER CHECK (nr_dia_vencimento IS NULL OR nr_dia_vencimento BETWEEN 1 AND 31),
  sn_agua_no_condominio BOOLEAN,             -- null = ainda não se sabe
  tp_seguro_incendio VARCHAR(20) CHECK (tp_seguro_incendio IS NULL OR tp_seguro_incendio IN
    ('ja_possui', 'locador', 'locatario', 'dividido', 'nao_contratado')),
  tp_garantia VARCHAR(20) CHECK (tp_garantia IS NULL OR tp_garantia IN ('caucao', 'sem_garantia')),
  nr_caucao_meses INTEGER CHECK (nr_caucao_meses IS NULL OR nr_caucao_meses BETWEEN 1 AND 3),
  sn_caucao_com_taxas BOOLEAN,               -- true = aluguel + condomínio + IPTU; false = só o aluguel
  ds_pix_locador VARCHAR(120),
  ds_titular_conta VARCHAR(255),             -- em branco = o próprio locador
  sn_pintura_nova BOOLEAN,                   -- imóvel entregue pintado (devolve COM pintura)
  sn_vistoria_soma BOOLEAN,                  -- a SOMA elabora o Termo de Vistoria?
  ds_observacoes TEXT,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

DROP TRIGGER IF EXISTS trg_processo_locacao_ts ON soma.processo_locacao;
CREATE TRIGGER trg_processo_locacao_ts BEFORE UPDATE ON soma.processo_locacao
  FOR EACH ROW EXECUTE PROCEDURE soma.fn_atualizar_timestamp();

ALTER TABLE soma.processo_locacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "processo_locacao_select" ON soma.processo_locacao;
CREATE POLICY "processo_locacao_select" ON soma.processo_locacao FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));

-- ----------------------------------------------------------------
-- Grava os dados da locação (e marca o processo como locação).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_salvar_dados_locacao(p_cd_processo UUID, p_dados JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_garantia TEXT := NULLIF(p_dados->>'tp_garantia', '');
  v_meses INTEGER := NULLIF(p_dados->>'nr_caucao_meses', '')::integer;
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico pode editar os dados da locação.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM soma.processos WHERE cd_processo = p_cd_processo AND tp_processo = 'contrato') THEN
    RAISE EXCEPTION 'Processo de contrato não encontrado.';
  END IF;

  IF v_garantia = 'caucao' AND (v_meses IS NULL OR v_meses NOT BETWEEN 1 AND 3) THEN
    RAISE EXCEPTION 'A caução em dinheiro vale de 1 a 3 aluguéis (Lei do Inquilinato, art. 38, § 2º).';
  END IF;

  UPDATE soma.processos SET tp_contrato = 'locacao' WHERE cd_processo = p_cd_processo;

  INSERT INTO soma.processo_locacao (
    cd_processo, vl_aluguel, vl_condominio, vl_iptu, nr_prazo_meses, dt_inicio, dt_entrega_chaves,
    nr_dia_vencimento, sn_agua_no_condominio, tp_seguro_incendio, tp_garantia, nr_caucao_meses,
    sn_caucao_com_taxas, ds_pix_locador, ds_titular_conta, sn_pintura_nova, sn_vistoria_soma, ds_observacoes
  )
  VALUES (
    p_cd_processo,
    NULLIF(p_dados->>'vl_aluguel', '')::numeric,
    NULLIF(p_dados->>'vl_condominio', '')::numeric,
    NULLIF(p_dados->>'vl_iptu', '')::numeric,
    NULLIF(p_dados->>'nr_prazo_meses', '')::integer,
    NULLIF(p_dados->>'dt_inicio', '')::date,
    NULLIF(p_dados->>'dt_entrega_chaves', '')::date,
    NULLIF(p_dados->>'nr_dia_vencimento', '')::integer,
    NULLIF(p_dados->>'sn_agua_no_condominio', '')::boolean,
    NULLIF(p_dados->>'tp_seguro_incendio', ''),
    v_garantia,
    CASE WHEN v_garantia = 'caucao' THEN v_meses END,
    CASE WHEN v_garantia = 'caucao' THEN NULLIF(p_dados->>'sn_caucao_com_taxas', '')::boolean END,
    NULLIF(trim(p_dados->>'ds_pix_locador'), ''),
    NULLIF(trim(p_dados->>'ds_titular_conta'), ''),
    NULLIF(p_dados->>'sn_pintura_nova', '')::boolean,
    NULLIF(p_dados->>'sn_vistoria_soma', '')::boolean,
    NULLIF(trim(p_dados->>'ds_observacoes'), '')
  )
  ON CONFLICT (cd_processo) DO UPDATE SET
    vl_aluguel = EXCLUDED.vl_aluguel,
    vl_condominio = EXCLUDED.vl_condominio,
    vl_iptu = EXCLUDED.vl_iptu,
    nr_prazo_meses = EXCLUDED.nr_prazo_meses,
    dt_inicio = EXCLUDED.dt_inicio,
    dt_entrega_chaves = EXCLUDED.dt_entrega_chaves,
    nr_dia_vencimento = EXCLUDED.nr_dia_vencimento,
    sn_agua_no_condominio = EXCLUDED.sn_agua_no_condominio,
    tp_seguro_incendio = EXCLUDED.tp_seguro_incendio,
    tp_garantia = EXCLUDED.tp_garantia,
    nr_caucao_meses = EXCLUDED.nr_caucao_meses,
    sn_caucao_com_taxas = EXCLUDED.sn_caucao_com_taxas,
    ds_pix_locador = EXCLUDED.ds_pix_locador,
    ds_titular_conta = EXCLUDED.ds_titular_conta,
    sn_pintura_nova = EXCLUDED.sn_pintura_nova,
    sn_vistoria_soma = EXCLUDED.sn_vistoria_soma,
    ds_observacoes = EXCLUDED.ds_observacoes;
END;
$$;

REVOKE ALL ON FUNCTION soma.fn_salvar_dados_locacao(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soma.fn_salvar_dados_locacao(UUID, JSONB) TO authenticated;

-- ----------------------------------------------------------------
-- Campos {{locacao_*}} do modelo. Contrato de venda = '{}'. O que não foi
-- informado fica nulo (vira "__________" na minuta, pro Jurídico completar).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_campos_locacao(p_cd_processo UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  l soma.processo_locacao%ROWTYPE;
  v_tipo TEXT;
  v_total NUMERIC;
  v_base NUMERIC;
  v_caucao NUMERIC;
  v_taxas TEXT[] := ARRAY[]::TEXT[];
  v_nomes TEXT[];
  v_fim DATE;
  v_prim DATE;
  v_ult DATE;
  v_ref DATE;
  v_titular TEXT;
  v_seguro TEXT;
  v_agua TEXT;
  v_pintura TEXT;
BEGIN
  SELECT tp_contrato INTO v_tipo FROM soma.processos WHERE cd_processo = p_cd_processo;
  IF v_tipo IS DISTINCT FROM 'locacao' THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT * INTO l FROM soma.processo_locacao WHERE cd_processo = p_cd_processo;
  IF NOT FOUND THEN
    RETURN '{}'::jsonb;
  END IF;

  v_total := NULLIF(COALESCE(l.vl_aluguel, 0) + COALESCE(l.vl_condominio, 0) + COALESCE(l.vl_iptu, 0), 0);

  IF NULLIF(l.vl_iptu, 0) IS NOT NULL THEN
    v_taxas := v_taxas || 'IPTU'::text;
  END IF;
  IF NULLIF(l.vl_condominio, 0) IS NOT NULL THEN
    v_taxas := v_taxas || ('condomínio' || CASE WHEN l.sn_agua_no_condominio THEN ' (com água)' ELSE '' END);
  END IF;

  -- Datas: o término é o aniversário do início; o 1º vencimento é no mês seguinte
  -- ao início e o último no mês do término (como nos contratos da SOMA).
  IF l.dt_inicio IS NOT NULL AND l.nr_prazo_meses IS NOT NULL THEN
    v_fim := (l.dt_inicio + make_interval(months => l.nr_prazo_meses))::date;
  END IF;
  IF l.dt_inicio IS NOT NULL AND l.nr_dia_vencimento IS NOT NULL THEN
    v_ref := (date_trunc('month', l.dt_inicio) + interval '1 month')::date;
    v_prim := v_ref + (least(l.nr_dia_vencimento,
      extract(day FROM (v_ref + interval '1 month' - interval '1 day'))::int) - 1);
  END IF;
  IF v_fim IS NOT NULL AND l.nr_dia_vencimento IS NOT NULL THEN
    v_ref := date_trunc('month', v_fim)::date;
    v_ult := v_ref + (least(l.nr_dia_vencimento,
      extract(day FROM (v_ref + interval '1 month' - interval '1 day'))::int) - 1);
  END IF;

  SELECT array_agg(nm_parte ORDER BY nr_ordem, nm_parte) INTO v_nomes
  FROM soma.processo_parte
  WHERE cd_processo = p_cd_processo AND tp_lado = 'vendedor' AND COALESCE(tp_vinculo, '') NOT IN ('representante', 'anuente');
  v_titular := COALESCE(NULLIF(trim(l.ds_titular_conta), ''), soma.fn_juntar_nomes(v_nomes));

  v_agua := CASE l.sn_agua_no_condominio
    WHEN true THEN 'A água encontra-se atualmente incluída na taxa condominial. Contudo, caso venha a ser individualizada durante a vigência deste contrato, seu pagamento passará a ser de exclusiva responsabilidade do LOCATÁRIO, independentemente de aditamento contratual.'
    WHEN false THEN 'A água é cobrada de forma individual, sendo de exclusiva responsabilidade do LOCATÁRIO o seu pagamento até as respectivas datas de vencimento.'
  END;

  v_seguro := CASE l.tp_seguro_incendio
    WHEN 'ja_possui' THEN 'o imóvel já possui seguro-incêndio contratado, que permanece vigente nas condições da respectiva apólice.'
    WHEN 'locador' THEN 'o seguro-incêndio do imóvel será contratado e pago pelo LOCADOR.'
    WHEN 'locatario' THEN 'o seguro-incêndio do imóvel será contratado e pago pelo LOCATÁRIO, que deverá apresentar a apólice ao LOCADOR.'
    WHEN 'dividido' THEN 'o seguro-incêndio do imóvel será contratado e o seu custo dividido em partes iguais entre LOCADOR e LOCATÁRIO.'
    WHEN 'nao_contratado' THEN 'as partes, de comum acordo, optam por não contratar seguro-incêndio, assumindo cada qual os riscos decorrentes dessa escolha.'
  END;
  v_seguro := upper(left(v_seguro, 1)) || substr(v_seguro, 2);

  v_pintura := CASE l.sn_pintura_nova
    WHEN true THEN 'COM pintura'
    WHEN false THEN 'nas mesmas condições de pintura em que o recebeu, sem obrigação de nova pintura'
  END;

  IF l.tp_garantia = 'caucao' THEN
    v_base := CASE WHEN l.sn_caucao_com_taxas THEN v_total ELSE NULLIF(l.vl_aluguel, 0) END;
    v_caucao := v_base * l.nr_caucao_meses;
  END IF;

  RETURN jsonb_build_object(
    'locacao_prazo', CASE WHEN l.nr_prazo_meses IS NOT NULL THEN
      l.nr_prazo_meses || ' (' || soma.fn_extenso_inteiro(l.nr_prazo_meses) || ') ' || CASE WHEN l.nr_prazo_meses = 1 THEN 'mês' ELSE 'meses' END END,
    'locacao_prazo_meses', l.nr_prazo_meses::text,
    'locacao_inicio', to_char(l.dt_inicio, 'DD/MM/YYYY'),
    'locacao_fim', to_char(v_fim, 'DD/MM/YYYY'),
    'locacao_ano', extract(year FROM l.dt_inicio)::int || ' (' || soma.fn_extenso_inteiro(extract(year FROM l.dt_inicio)::bigint) || ')',
    'locacao_chaves', to_char(COALESCE(l.dt_entrega_chaves, l.dt_inicio), 'DD/MM/YYYY'),
    'locacao_aluguel', soma.fn_formatar_moeda(NULLIF(l.vl_aluguel, 0)),
    'locacao_aluguel_extenso', soma.fn_valor_extenso(NULLIF(l.vl_aluguel, 0)),
    'locacao_condominio', soma.fn_formatar_moeda(NULLIF(l.vl_condominio, 0)),
    'locacao_condominio_extenso', soma.fn_valor_extenso(NULLIF(l.vl_condominio, 0)),
    'locacao_iptu', soma.fn_formatar_moeda(NULLIF(l.vl_iptu, 0)),
    'locacao_iptu_extenso', soma.fn_valor_extenso(NULLIF(l.vl_iptu, 0)),
    'locacao_aluguel_total', soma.fn_formatar_moeda(v_total),
    'locacao_aluguel_total_extenso', soma.fn_valor_extenso(v_total),
    'locacao_taxas', soma.fn_juntar_nomes(v_taxas),
    'locacao_dia_vencimento', CASE WHEN l.nr_dia_vencimento IS NOT NULL THEN
      l.nr_dia_vencimento || ' (' || soma.fn_extenso_inteiro(l.nr_dia_vencimento) || ')' END,
    'locacao_primeiro_pagamento', to_char(v_prim, 'DD/MM/YYYY'),
    'locacao_ultimo_pagamento', to_char(v_ult, 'DD/MM/YYYY'),
    'locacao_pix', l.ds_pix_locador,
    'locacao_titular', v_titular,
    'locacao_agua_texto', v_agua,
    'locacao_seguro', v_seguro,
    'locacao_devolucao_pintura', v_pintura,
    -- Só "sem garantia" tira a cláusula de caução; garantia ainda não informada
    -- mantém a cláusula, com os valores em branco pro Jurídico completar.
    'locacao_tem_caucao', CASE WHEN l.tp_garantia IS DISTINCT FROM 'sem_garantia' THEN 'sim' END,
    'locacao_caucao_valor', soma.fn_formatar_moeda(v_caucao),
    'locacao_caucao_valor_extenso', soma.fn_valor_extenso(v_caucao),
    'locacao_caucao_meses_txt', CASE WHEN l.nr_caucao_meses IS NOT NULL THEN
      lpad(l.nr_caucao_meses::text, 2, '0') || ' (' || soma.fn_extenso_inteiro(l.nr_caucao_meses) || ') ' ||
      CASE WHEN l.nr_caucao_meses = 1 THEN 'mês' ELSE 'meses' END END,
    'locacao_caucao_base', CASE l.sn_caucao_com_taxas WHEN true THEN 'COM taxas' WHEN false THEN 'SEM taxas' END
  );
END;
$$;

REVOKE ALL ON FUNCTION soma.fn_campos_locacao(UUID) FROM PUBLIC;

-- ----------------------------------------------------------------
-- Render do modelo (070) + campos da locação.
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

  -- Locação: prazo, valores, caução, seguro etc. (vazio em contrato de venda)
  v_campos := v_campos || soma.fn_campos_locacao(p_cd_processo);

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


-- ----------------------------------------------------------------
-- Frentes que aprovam a minuta (043): na locação, locador, locatário e
-- jurídico sempre; corretor e imobiliária só se existirem no processo.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_registrar_minuta(
  p_cd_processo UUID,
  p_ds_storage_url TEXT,
  p_ds_conteudo TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_minuta UUID;
  v_nr_versao INTEGER;
  v_tp_contrato TEXT;
  v_qtd INTEGER;
BEGIN
  SELECT COALESCE(MAX(nr_versao), 0) + 1 INTO v_nr_versao
  FROM soma.minutas WHERE cd_processo = p_cd_processo;

  SELECT tp_contrato INTO v_tp_contrato FROM soma.processos WHERE cd_processo = p_cd_processo;

  INSERT INTO soma.minutas (cd_processo, cd_criador, nr_versao, ds_storage_url, ds_conteudo)
  VALUES (p_cd_processo, auth.uid(), v_nr_versao, p_ds_storage_url, p_ds_conteudo)
  RETURNING cd_minuta INTO v_cd_minuta;

  INSERT INTO soma.minuta_aprovacoes (cd_minuta, tp_papel)
  SELECT v_cd_minuta, papel
  FROM (VALUES ('corretor'), ('comprador'), ('vendedor'), ('imobiliaria'), ('juridico')) AS p(papel)
  WHERE v_tp_contrato IS DISTINCT FROM 'locacao'
     OR papel IN ('comprador', 'vendedor', 'juridico')
     OR (papel = 'corretor' AND EXISTS (SELECT 1 FROM soma.processo_corretor WHERE cd_processo = p_cd_processo))
     OR (papel = 'imobiliaria' AND EXISTS (
          SELECT 1 FROM soma.processos WHERE cd_processo = p_cd_processo AND cd_imobiliaria IS NOT NULL));

  GET DIAGNOSTICS v_qtd = ROW_COUNT;

  UPDATE soma.processos SET tp_etapa_contrato = 'minuta_pendente' WHERE cd_processo = p_cd_processo;

  PERFORM soma.fn_registrar_andamento(
    p_cd_processo,
    'Minuta enviada',
    'Minuta (versão ' || v_nr_versao || ') enviada para aprovação das ' || v_qtd || ' frentes.'
  );

  RETURN v_cd_minuta;
END;
$$;

-- ----------------------------------------------------------------
-- Link do cliente (074) + tipo de contrato.
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
    'sn_uniao_estavel', v_parte.sn_uniao_estavel,
    'ds_situacao_conjugal', v_parte.ds_situacao_conjugal,
    'ds_numero_processo', v_numero,
    'tp_contrato', (SELECT tp_contrato FROM soma.processos WHERE cd_processo = v_parte.cd_processo),
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

REVOKE ALL ON FUNCTION soma.fn_parte_processo_por_token(UUID) FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------
-- Modelo do contrato de locação (caução / sem garantia).
-- ----------------------------------------------------------------
DO $modelo_seed$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM soma.modelos_contrato WHERE nm_modelo = 'Contrato de locação residencial — caução'
  ) THEN
    INSERT INTO soma.modelos_contrato (nm_modelo, ds_descricao, ds_conteudo)
    VALUES (
      'Contrato de locação residencial — caução',
      'Locação residencial com garantia em caução (1 a 3 aluguéis) ou sem garantia. Usa os campos {{locacao_*}} do processo de aluguel.',
      $modelo$CONTRATO DE LOCAÇÃO DE IMÓVEL RESIDENCIAL

Pelo presente instrumento particular e na melhor forma de direito, fazem as partes entre si nomeadas e qualificadas na forma abaixo:

CLÁUSULA PRIMEIRA - DAS PARTES

{{#vendedor_1_pj}}De um lado, {{vendedor_1}}, pessoa jurídica de direito privado, {{vendedor_1_tipo_societario}}, inscrita no CNPJ/MF sob nº {{vendedor_1_cpf}}, NIRE nº {{vendedor_1_nire}}, com sede na {{vendedor_1_endereco}}, neste ato representada, {{vendedor_representacao}}, por seus sócios-administradores: {{vendedor_representantes}}{{#vendedor_anuentes}}; com a expressa anuência de seus demais sócios: {{vendedor_anuentes}}{{/vendedor_anuentes}}. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como LOCADOR.{{/vendedor_1_pj}}{{^vendedor_1_pj}}De um lado, {{vendedor_1}}, brasileiro, maior, capaz, {{vendedor_1_profissao}}, nascido em {{vendedor_1_nascimento}}, natural de {{vendedor_1_naturalidade}}, filiação de {{vendedor_1_filiacao}}, portador da cédula de identidade nº {{vendedor_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{vendedor_1_cpf}}{{#vendedor_2}}{{#vendedor_2_conjuge}}, casado sob o regime da {{vendedor_2_regime_bens}} com {{/vendedor_2_conjuge}}{{#vendedor_2_companheiro}}, convivente em união estável com {{/vendedor_2_companheiro}}{{#vendedor_2_outro}}, e {{/vendedor_2_outro}}{{#vendedor_2_anuente}}, e, na qualidade de ANUENTE, {{/vendedor_2_anuente}}{{vendedor_2}}, brasileira, maior, capaz, {{vendedor_2_profissao}}, nascida em {{vendedor_2_nascimento}}, natural de {{vendedor_2_naturalidade}}, filiação de {{vendedor_2_filiacao}}, portadora da cédula de identidade nº {{vendedor_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{vendedor_2_cpf}}, ambos residentes e domiciliados na {{vendedor_1_endereco}}{{/vendedor_2}}{{^vendedor_2}}, residente e domiciliado na {{vendedor_1_endereco}}{{/vendedor_2}}. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como LOCADOR.{{/vendedor_1_pj}}

De outro lado, {{comprador_1}}, brasileiro, maior, capaz, {{comprador_1_profissao}}, {{^comprador_2}}solteiro e declara não conviver em união estável, {{/comprador_2}}nascido em {{comprador_1_nascimento}}, natural de {{comprador_1_naturalidade}}, filiação de {{comprador_1_filiacao}}, portador da cédula de identidade nº {{comprador_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{comprador_1_cpf}}{{#comprador_2}}{{#comprador_2_conjuge}}, casado sob o regime da {{comprador_2_regime_bens}} com {{/comprador_2_conjuge}}{{#comprador_2_companheiro}}, convivente em união estável com {{/comprador_2_companheiro}}{{#comprador_2_outro}}, e {{/comprador_2_outro}}{{#comprador_2_anuente}}, e, na qualidade de ANUENTE, {{/comprador_2_anuente}}{{comprador_2}}, brasileira, maior, capaz, {{comprador_2_profissao}}, nascida em {{comprador_2_nascimento}}, natural de {{comprador_2_naturalidade}}, filiação de {{comprador_2_filiacao}}, portadora da cédula de identidade nº {{comprador_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{comprador_2_cpf}}, ambos residentes e domiciliados na {{comprador_1_endereco}}{{/comprador_2}}{{^comprador_2}}, residente e domiciliado na {{comprador_1_endereco}}{{/comprador_2}}. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como LOCATÁRIO.

Assim, firmam as partes entre si justos e contratados o seguinte:

CLÁUSULA SEGUNDA - DO IMÓVEL

{{imovel_descricao}}, conforme descrito na matrícula nº {{imovel_matricula}} do {{imovel_cartorio_numero}} Cartório de Registro de Imóveis de {{imovel_cartorio_cidade}}/BA{{#imovel_iptu}} e Inscrição imobiliária municipal nº {{imovel_iptu}}{{/imovel_iptu}}.

2.1 - Endereço (IPTU): {{imovel_endereco}}{{#imovel_iptu}} — inscrição municipal nº {{imovel_iptu}}{{/imovel_iptu}}

CLÁUSULA TERCEIRA – DO PRAZO DE VIGÊNCIA

O prazo de vigência da presente locação é de {{locacao_prazo}}, a iniciar-se no dia {{locacao_inicio}} e com término em {{locacao_fim}}, data em que, de pleno direito a locação cessa, obrigando-se o LOCATÁRIO a restituir o referido imóvel ao LOCADOR, completamente desocupado de pessoas e objetos pessoais, bem como com todos os alugueis, taxas e contas de consumo quitados, sob pena de incorrer na multa estipulada no presente.

3.1 - Somente será considerado rescindido o presente contrato após a efetiva entrega das chaves pelo LOCATÁRIO, cumpridas todas as obrigações e encargos estabelecidos neste instrumento.

3.2 - Findo o prazo estipulado neste contrato, caso o LOCATÁRIO permaneça no imóvel sem manifestação contrária do LOCADOR, a locação será automaticamente prorrogada por prazo indeterminado, nas mesmas condições ajustadas neste instrumento, nos termos do art. 46 da Lei nº 8.245/91. Caso as partes desejem a continuidade da locação por prazo determinado, deverá ser celebrado novo contrato ou aditivo contratual, contendo o valor do aluguel devidamente atualizado e o novo prazo de vigência, antes do término do prazo contratual ora ajustado.

3.3 – Durante o prazo estipulado do contrato ({{locacao_prazo_meses}} meses), o LOCADOR não poderá reaver o imóvel, salvo nos casos previstos pelo art. 47 da Lei do Inquilinato, como mútuo acordo, infração contratual ou legal, falta de pagamento de aluguel e encargos, reparos urgentes determinados pelo Poder Público ou uso próprio do LOCADOR. O LOCATÁRIO poderá devolver o imóvel antes do término do contrato, pagando multa proporcional ao período restante, conforme Cláusula Sexta.

3.3.1 – Após os 12 (doze) meses de contrato, o LOCATÁRIO poderá rescindir a locação mediante aviso prévio de 30 (trinta) dias corridos, sem pagamento de multa.

3.3.2 - O LOCATÁRIO ficará dispensado da multa se a devolução do imóvel decorrer de transferência, pelo seu empregador, para prestar serviços em localidades diversas daquela do início do contrato, desde que haja comprovação e aviso prévio de 30 (trinta) dias ao LOCADOR.

CLÁUSULA QUARTA - DOS ALUGUÉIS, REAJUSTES E PAGAMENTOS

Em comum acordo, o LOCATÁRIO será responsável pelo aluguel mensal de {{locacao_aluguel_total}} ({{locacao_aluguel_total_extenso}}){{#locacao_taxas}}, já incluso neste valor as taxas inerentes ao imóvel de {{locacao_taxas}}, cujos pagamentos dos boletos ficarão sob a responsabilidade exclusiva do LOCADOR com o valor proveniente da LOCAÇÃO{{/locacao_taxas}}, exceto a luz e gás, que são de responsabilidade do LOCATÁRIO.

4.1 - Sendo na vigência de {{locacao_ano}} o valor do aluguel em {{locacao_aluguel}} ({{locacao_aluguel_extenso}}){{#locacao_condominio}}, o condomínio ordinário no valor de {{locacao_condominio}} ({{locacao_condominio_extenso}}){{/locacao_condominio}}{{#locacao_iptu}}{{#locacao_condominio}} e{{/locacao_condominio}}{{^locacao_condominio}},{{/locacao_condominio}} o IPTU no valor de {{locacao_iptu}} ({{locacao_iptu_extenso}}){{/locacao_iptu}}, totalizando o valor cobrado mensalmente de {{locacao_aluguel_total}} ({{locacao_aluguel_total_extenso}}).{{#locacao_taxas}} Ficando acordado entre as partes, que sempre que existir aumento normal relativo à parcela do Condomínio ordinário e IPTU, este aumento será acrescido ao valor do aluguel, ora pactuado{{#locacao_tem_caucao}}, sem prejuízo do quanto previsto na Cláusula Sétima (caução){{/locacao_tem_caucao}}.{{/locacao_taxas}}

{{#locacao_iptu}}4.1.1 - Fica expressamente ajustado que o IPTU, embora seja encargo legal do LOCADOR, passa a ser de inteira responsabilidade do LOCATÁRIO, que autoriza o pagamento direto pelo LOCADOR, já ressarcido através do valor mensal do aluguel.

{{/locacao_iptu}}4.2 - Em comum acordo, os alugueis deverão ser pagos até todo o dia {{locacao_dia_vencimento}} de cada mês, sendo o primeiro pagamento MENSAL até o dia {{locacao_primeiro_pagamento}} e o último no dia {{locacao_ultimo_pagamento}}, subsequente ao vencido, através de transferência bancária para a conta {{vendedor_1_conta}}{{#locacao_pix}} ou PIX {{locacao_pix}}{{/locacao_pix}}, de titularidade de {{locacao_titular}}, sob pena de não o fazendo configurar em quebra de contrato, com a aplicação das demais disposições contidas neste instrumento.

4.3 – Durante a posse do LOCATÁRIO, as despesas do imóvel com o consumo de luz, gás, esgoto e outras utilidades, serão sempre de exclusiva responsabilidade do LOCATÁRIO, que se obriga a fazer pagamentos até as suas respectivas datas de vencimento.

4.3.1 – {{locacao_agua_texto}}

4.4 - O reajuste anual incidirá exclusivamente sobre o valor do aluguel puro, atualmente fixado em {{locacao_aluguel}} ({{locacao_aluguel_extenso}}), na data de aniversário deste contrato, pelo IVAR (Índice de Variação de Aluguéis Residenciais). Caso esse índice seja extinto, será aplicado o IPCA ou outro índice oficial que venha a substituí-lo.{{#locacao_taxas}} As parcelas referentes ao condomínio e ao IPTU serão atualizadas de acordo com os respectivos valores efetivamente cobrados, nos termos da Cláusula 4.1, não se sujeitando ao reajuste previsto nesta cláusula.{{/locacao_taxas}}

4.5 – O não pagamento no prazo implicará multa de 10% (dez por cento) sobre o valor devido, acrescido de juros de mora de 1% (um por cento) ao mês pro rata die, além de correção monetária pelo índice pactuado, até o pagamento integral pelo LOCATÁRIO.

4.6 – Para fins fiscais, declara o LOCADOR que o valor de referência do aluguel puro corresponde a {{locacao_aluguel}}, independentemente das taxas e encargos ora pactuados, que são de responsabilidade do LOCATÁRIO.

CLÁUSULA QUINTA – DOS ENCARGOS E DAS OBRIGAÇÕES DO LOCATÁRIO

5.1 – O LOCATÁRIO obriga-se a apresentar ou entregar ao LOCADOR, ou a quem ele designar em receber, qualquer correspondência, avisos de impostos, notificações ou intimações que vierem a ser enviadas para o endereço do imóvel objeto desta locação.

5.2 – O LOCATÁRIO é responsável pela conservação e limpeza do imóvel, realizando pequenos reparos e manutenção necessária à preservação do mesmo. Qualquer reforma ou alteração estrutural depende de prévia autorização por escrito do LOCADOR.

5.2.1 - O LOCATÁRIO estará obrigado a devolver o imóvel em perfeitas condições de limpeza, conservação da mobília e {{locacao_devolucao_pintura}}, quando finda ou rescindida esta avença, conforme constante no Termo de Vistoria em anexo.

5.2.2 - O LOCATÁRIO não pode realizar obras que alterem ou modifiquem a estrutura do imóvel locado, sem prévia autorização por escrito do LOCADOR. Caso este consinta na realização das obras, estas ficarão desde logo, incorporadas ao imóvel, sem que assista ao LOCATÁRIO qualquer indenização pelas obras ou retenção por benfeitorias. As benfeitorias removíveis poderão ser retiradas, desde que não desfigurem o imóvel locado.

5.3 - O LOCATÁRIO declara receber o imóvel em perfeito estado de conservação e perfeito funcionamento devendo observar o que consta no termo de vistoria, sendo responsável por devolver o imóvel em iguais condições.

5.4 - O LOCATÁRIO declara que o imóvel ora locado, destina-se única e exclusivamente para o seu uso residencial e de sua família.

5.5 - O LOCATÁRIO, obriga por si, sua família e terceiros que o LOCATÁRIO tenha autorizado a entrada no imóvel, a cumprirem e a fazer cumprir integralmente as disposições legais sobre o Condomínio, a sua Convenção e o seu Regulamento Interno.

5.6 - O LOCATÁRIO não poderá sublocar, transferir ou ceder o imóvel, sendo nulo de pleno direito qualquer ato praticado com este fim sem o consentimento prévio e por escrito do LOCADOR.

5.7 – O LOCATÁRIO deverá providenciar a transferência de titularidade das contas de luz e gás em até 30 dias corridos à partir da posse, sendo responsável pelo pagamento dos valores de consumo até a efetiva transferência. A não realização não implicará multa diária, mas poderá ensejar cobrança judicial ou execução de obrigação de fazer.

5.8 – Seguro-incêndio: {{locacao_seguro}}

{{#imovel_itens}}5.9 - Permanecem no imóvel, em perfeito estado de funcionamento e conservação, os seguintes itens, os quais constam do Termo de Vistoria: {{imovel_itens}}

{{/imovel_itens}}CLÁUSULA SEXTA – DAS PENALIDADES

As partes estabelecem multa equivalente a 02 (dois) meses de aluguel vigente à época da infração, a título indenizatório, exceto na hipótese de rescisão antecipada, que será proporcional ao período de cumprimento do contrato. O pagamento da multa não exime o infrator da obrigação principal, nem limita a responsabilização por perdas e danos adicionais.

6.1 – Em caso de inadimplência ou descumprimento contratual, os valores de aluguéis, encargos, multas, indenizações e afins, poderão ser cobrados judicialmente, incluindo despesas judiciais e honorários advocatícios, ficando a cargo da parte culpada.

{{#locacao_tem_caucao}}CLÁUSULA SÉTIMA – DA CAUÇÃO

Em comum acordo, o LOCATÁRIO concorda em depositar a título de garantia locatícia, a caução no valor de {{locacao_caucao_valor}} ({{locacao_caucao_valor_extenso}}), equivalente a {{locacao_caucao_meses_txt}} de aluguel {{locacao_caucao_base}}, no ato da assinatura deste contrato, através de transferência bancária para a conta descrita na Cláusula Quarta, Item 4.2.

7.1 - O valor da caução será utilizado para cobertura de quaisquer débitos, reparos ou encargos de responsabilidade do LOCATÁRIO, conforme previsto neste contrato. Caso seja necessário aplicar parte ou totalidade da caução, o LOCATÁRIO se obriga a repor imediatamente os valores utilizados, se solicitado pelo LOCADOR.

7.2 - Ao término da LOCAÇÃO, com a entrega das chaves e cumpridos todos os requisitos deste contrato, o LOCADOR realizará a devolução do montante remanescente da caução ao LOCATÁRIO, acrescido de todos os rendimentos da caderneta de poupança decorrentes do período em que a caução permaneceu depositada, em até 48 (quarenta e oito) horas corridas após a entrega das chaves. Caso haja atraso na devolução por culpa do LOCADOR, incidirá sobre o montante multa de 10% (dez por cento), juros de mora de 1% (um por cento) ao mês e correção monetária pelo índice da caderneta de poupança ou outro índice oficial que venha a substituí-lo, contados a partir do término do prazo.

7.3 - Caso a caução seja insuficiente para cobrir débitos, reparos ou encargos, o LOCATÁRIO se obriga a pagar imediatamente a diferença ao LOCADOR. Nada obstante o previsto, caso o LOCATÁRIO não pague a diferença, permanece o direito do LOCADOR de buscar judicialmente qualquer valor remanescente devido pelo LOCATÁRIO que não tenha sido coberto pela caução. Se houver saldo remanescente após utilização parcial da caução, este será transferido ao LOCATÁRIO em até 48 (quarenta e oito) horas corridas.

7.4 - O uso da caução não impede a cobrança de valores devidos ou a adoção de medidas judiciais cabíveis em caso de inadimplência ou descumprimento de obrigações contratuais pelo LOCATÁRIO.

{{/locacao_tem_caucao}}{{^locacao_tem_caucao}}CLÁUSULA SÉTIMA – DA GARANTIA LOCATÍCIA

As partes declaram que a presente locação é celebrada sem garantia locatícia, de comum acordo, assumindo o LOCADOR os riscos decorrentes dessa escolha.

{{/locacao_tem_caucao}}CLÁUSULA OITAVA – DO ENCERRAMENTO OU RESCISÃO DO CONTRATO

O encerramento ou a rescisão da locação, ora celebrada, fica condicionada à prévia vistoria do imóvel, feita pelo LOCADOR, quando será constatado o seu estado, bem como, verificado o cumprimento de todo o disposto neste contrato. A locação termina com a devolução das chaves e recibo próprio de quitação, fornecido pelo LOCADOR, não se considerando como seu término o ato de abandono das chaves no imóvel, ou em qualquer outro lugar, nem sua entrega a quem quer que seja, a não ser ao LOCADOR ou a quem este indicar por escrito.

8.1 – As chaves do imóvel serão entregues ao LOCATÁRIO no dia {{locacao_chaves}} e serão, quando finda a locação, devolvidas ao LOCADOR. Tal devolução será obrigatoriamente precedida de uma vistoria do imóvel e elaboração de outro termo de vistoria, caso torna-se necessário, que, se levando em consideração o desgaste natural do imóvel este coincidente com o primeiro, será assinado pelas partes, dando por quitadas todas as obrigações oriundas do presente contrato. Tal quitação será reproduzida através do competente TERMO DE ENTREGA DAS CHAVES E DISTRATO DO CONTRATO, e que contará com o referido laudo como anexo.

8.1.1 – Caso sejam necessários reparos ou obras identificadas na vistoria, o LOCATÁRIO deverá realizá-lo no prazo estipulado pelo LOCADOR, preferencialmente até a data de encerramento do contrato.

8.1.2 – Durante a execução das obras, o LOCATÁRIO continua responsável pelo pagamento do aluguel e encargos, até a aceitação das chaves pelo LOCADOR, com demonstração do consentimento do estado do imóvel.

8.1.3 – No momento da entrega definitiva das chaves o LOCATÁRIO ficará obrigado a apresentar o comprovante de quitação das despesas com consumo de energia elétrica, água e gás (acompanhados dos protocolos de baixa no fornecimento) e outros impostos ou taxas que venha a incidir sobre o referido imóvel.

8.1.4 – O LOCADOR não se responsabilizará por qualquer conta de energia elétrica e/ou demais utilidades/despesas inerentes a esta locação, nem mesmo após a rescisão contratual, visto que, é de responsabilidade do LOCATÁRIO solicitar troca de titularidade dos serviços contratados no início da locação e a baixa imediata e total quitação das referidas despesas/consumo (incluindo neste consumo proporcional a vencer) após rescisão contratual.

8.2 - No caso de recusa ou mora do recebimento das chaves pelo LOCADOR, será considerado como entregue as chaves do referido imóvel, se sendo notificada pelo LOCATÁRIO a receber as chaves no prazo de 05 (cinco) dias corridos, presumindo-se entregue as chaves na portaria do imóvel ora alugado.

8.3 – A infração de qualquer obrigação e das Cláusulas deste contrato poderá ensejar na rescisão automática, sendo dever da parte que deu causa à rescisão à reparação pelas perdas e danos que se fizeram presentes, bem como, a multa contratual elencada no Caput da Cláusula Sexta, sem prejuízo das outras penalidades previstas.

8.3.1 – Atraso no pagamento do aluguel superior a 30 (trinta) dias consecutivos ensejará na RESCISÃO AUTOMÁTICA do contrato, sem prejuízo da multa, cobrança dos valores vencidos e das medidas legais cabíveis.

8.4 – A multa estipulada nos três parágrafos anteriores quanto a rescisão antecipada será paga pela parte que deu causa de modo proporcional ao tempo que falta ao término deste contrato de locação.

CLÁUSULA NONA - DAS DISPOSIÇÕES FINAIS

9.1 – O LOCADOR declara ser o legítimo proprietário do imóvel objeto deste contrato, que sua descrição corresponde à realidade quanto à localização, numeração e características, e que não existem dívidas, ônus, ações judiciais ou quaisquer restrições legais que impeçam ou comprometam a validade desta locação, isentando os corretores de qualquer responsabilidade.

9.2 – O LOCATÁRIO declara conhecer o imóvel objeto deste contrato, concordar com sua localização, numeração e características, que todas as informações e documentos fornecidos (como profissão, renda, etc.) são verdadeiros, e que não existem dívidas, ações judiciais ou restrições em seu nome que impeçam a locação, assumindo plena responsabilidade por todas as declarações e seus efeitos legais.

9.3 – O LOCATÁRIO faculta, desde já, ao LOCADOR vistoriar o imóvel quando entender necessário e conveniente, desde que avisado com uma antecedência mínima de 48 (quarenta e oito) horas.

9.3.1 – Se por ocasião da vistoria for constatada qualquer irregularidade, o LOCADOR notificará ao LOCATÁRIO para, no prazo de 15 (quinze) dias, reparar o defeito por sua própria conta e risco, podendo haver prorrogação mediante acordo escrito.

9.4 – Todos os estragos ocasionados ao imóvel e suas instalações, assim como os acessórios, bem como as despesas que o LOCADOR for obrigado, por eventuais modificações feitas no imóvel pelo LOCATÁRIO, não ficam compreendidas na multa estabelecida na Cláusula Sexta, mas serão pagas à parte.

9.5 – Salvo por escrito, o recebimento das chaves pelo LOCADOR ao término da locação, não implica em quitação das obrigações assumidas pelo LOCATÁRIO, tanto no que diz respeito aos alugueis, despesas e encargos eventualmente devidos, como em relação ao ressarcimento por danos causados ao imóvel.

9.6 – O LOCADOR não poderá retomar o imóvel por conta própria em hipótese de abandono, devendo adotar as medidas judiciais cabíveis para retomada da posse, nos termos da Lei do Inquilinato.

9.7 – Em caso de venda do imóvel, o LOCATÁRIO terá direito de preferência, devendo receber comunicação por escrito, com prova de recebimento, e responder em até 30 (trinta) dias corridos. Caso não haja interesse ou resposta, o LOCADOR poderá negociar com terceiros, permitindo o LOCATÁRIO desde logo ao LOCADOR vistoriar o imóvel com possíveis pretendentes.

9.8 – Em caso de sinistro que torne o imóvel inabitável (incêndio, calamidade pública ou reconstrução judicialmente comprovada), não causado pelo LOCATÁRIO ou por terceiros autorizados por ele; o LOCATÁRIO deverá notificar imediatamente o LOCADOR por escrito e o contrato será rescindido sem multa, mediante entrega imediata do imóvel ao LOCADOR, sem qualquer penalidade adicional.

9.9 - O LOCADOR não se responsabiliza por objetos deixados no imóvel ou no veículo, bem como por furtos/roubos dos bens do LOCATÁRIO e outros danos causados por caso fortuito ou de força maior que ocasionem danos.

{{#honorarios_total}}9.10 - Em comum acordo, o LOCADOR compromete-se a efetuar o pagamento da comissão de intermediação imobiliária aos CORRETORES DE IMÓVEIS, {{#honorarios_quando}}{{honorarios_quando}}{{/honorarios_quando}}{{^honorarios_quando}}no ato da assinatura do presente contrato{{/honorarios_quando}}, no montante total de {{honorarios_total}} ({{honorarios_total_extenso}}), da seguinte forma:

{{honorarios_distribuicao}}

9.10.1 - Fica desde já ajustado que a obrigação do corretor limita-se à intermediação para a captação do LOCATÁRIO, não abrangendo a administração da locação, a qual permanece de inteira responsabilidade do LOCADOR. O pagamento da comissão é definitivo e irrevogável, não estando condicionado à permanência do LOCATÁRIO, ao adimplemento dos aluguéis ou a qualquer evento futuro, constituindo-se na remuneração exclusiva pela intermediação realizada.

{{/honorarios_total}}9.11 - Fica estabelecido que caberá ao LOCADOR as despesas com reparos relativos à infraestrutura do imóvel, vícios ocultos, instalações originais (elétrica, hidráulica, esgoto, telhado, laje, estrutura), bem como manutenção necessária à salubridade e segurança do imóvel. Caberá ao LOCATÁRIO apenas pequenos reparos decorrentes do uso regular, conforme definido em comum acordo. Em caso de danos causados por terceiros (ex.: vazamento do vizinho), a responsabilidade será do causador, não do LOCADOR nem do LOCATÁRIO.

9.12 – E assim por se acharem certos e ajustados, respondendo as partes, herdeiros e/ou sucessores ao seu fiel e exato cumprimento, observando todas as cláusulas e disposições na sua inteireza, às partes elegem o Foro da Cidade de Salvador, Bahia, como competente para esclarecimentos de dúvidas ou controvérsias, e, assinam o presente instrumento em 03 (três) vias e sem rasuras, na presença das testemunhas, também signatárias deste.

Salvador/BA, {{data_extenso}}.

LOCADOR

{{#vendedor_1_pj}}_________________________________________ _________________________________________{{/vendedor_1_pj}}{{^vendedor_1_pj}}_________________________________________{{#vendedor_2}} _________________________________________{{/vendedor_2}}{{/vendedor_1_pj}}

{{#vendedor_1_pj}}{{vendedor_1}} — CNPJ/MF Nº {{vendedor_1_cpf}}, representada por {{vendedor_representantes_nomes}}{{#vendedor_anuentes_nomes}}

SÓCIOS ANUENTES: {{vendedor_anuentes_nomes}}{{/vendedor_anuentes_nomes}}{{/vendedor_1_pj}}{{^vendedor_1_pj}}{{vendedor_1}} — CPF/MF Nº {{vendedor_1_cpf}}{{#vendedor_2}}          {{vendedor_2}} — CPF/MF Nº {{vendedor_2_cpf}}{{/vendedor_2}}{{/vendedor_1_pj}}

LOCATÁRIO

_________________________________________{{#comprador_2}} _________________________________________{{/comprador_2}}

{{comprador_1}}{{#comprador_2}}          {{comprador_2}}{{/comprador_2}}

CPF/MF Nº {{comprador_1_cpf}}{{#comprador_2}}          CPF/MF Nº {{comprador_2_cpf}}{{/comprador_2}}

TESTEMUNHAS: _________________________________ _________________________________
$modelo$
    );
  END IF;
END
$modelo_seed$;
