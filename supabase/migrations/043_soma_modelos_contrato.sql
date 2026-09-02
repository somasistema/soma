-- ================================================================
-- SOMA — Migration 043
-- Modelos de contrato: biblioteca de textos-base reutilizáveis que o
-- Jurídico monta uma vez e versiona. A partir de um modelo ativo,
-- gera-se a minuta de um processo de contrato — os {{campos}} são
-- trocados pelos dados do processo — e ela entra no mesmo fluxo das
-- 5 frentes da migration 041.
--
-- Também mexe em soma.minutas: até aqui toda minuta era um arquivo no
-- Storage (ds_storage_url NOT NULL). Agora ela também pode nascer de
-- um modelo, como texto puro (ds_conteudo), sem arquivo. Um dos dois
-- sempre existe (CHECK). O upload manual continua igual.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) soma.minutas aceita minuta como texto, não só arquivo.
--    fn_enviar_minuta (upload) e fn_gerar_minuta_de_modelo passam a
--    dividir a mesma rotina interna, fn_registrar_minuta.
-- ----------------------------------------------------------------
ALTER TABLE soma.minutas ALTER COLUMN ds_storage_url DROP NOT NULL;
ALTER TABLE soma.minutas ADD COLUMN ds_conteudo TEXT;
ALTER TABLE soma.minutas
  ADD CONSTRAINT chk_minutas_arquivo_ou_texto
  CHECK (ds_storage_url IS NOT NULL OR ds_conteudo IS NOT NULL);

-- Rotina interna: grava a minuta (arquivo OU texto), abre as 5 frentes,
-- move a etapa do processo e registra o andamento. Não checa perfil —
-- quem chama (fn_enviar_minuta / fn_gerar_minuta_de_modelo) já checou.
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
BEGIN
  SELECT COALESCE(MAX(nr_versao), 0) + 1 INTO v_nr_versao
  FROM soma.minutas WHERE cd_processo = p_cd_processo;

  INSERT INTO soma.minutas (cd_processo, cd_criador, nr_versao, ds_storage_url, ds_conteudo)
  VALUES (p_cd_processo, auth.uid(), v_nr_versao, p_ds_storage_url, p_ds_conteudo)
  RETURNING cd_minuta INTO v_cd_minuta;

  INSERT INTO soma.minuta_aprovacoes (cd_minuta, tp_papel)
  SELECT v_cd_minuta, papel
  FROM (VALUES ('corretor'), ('comprador'), ('vendedor'), ('imobiliaria'), ('juridico')) AS p(papel);

  UPDATE soma.processos SET tp_etapa_contrato = 'minuta_pendente' WHERE cd_processo = p_cd_processo;

  PERFORM soma.fn_registrar_andamento(
    p_cd_processo,
    'Minuta enviada',
    'Minuta (versão ' || v_nr_versao || ') enviada para aprovação das 5 frentes.'
  );

  RETURN v_cd_minuta;
END;
$$;

-- fn_enviar_minuta agora só valida o perfil e delega (mesma assinatura
-- da migration 041, nada muda pra quem chama).
CREATE OR REPLACE FUNCTION soma.fn_enviar_minuta(
  p_cd_processo UUID,
  p_ds_storage_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico pode enviar minuta.';
  END IF;

  RETURN soma.fn_registrar_minuta(p_cd_processo, p_ds_storage_url, NULL);
END;
$$;

-- ----------------------------------------------------------------
-- 2) Biblioteca de modelos. Uma linha = estado atual do modelo; o
--    histórico de versões vai pra soma.modelo_contrato_versoes.
--    Mesmo esquema da migration 041: RLS de leitura ampla (aqui, todo
--    o time interno), escrita só pelas funções SECURITY DEFINER.
-- ----------------------------------------------------------------
CREATE TABLE soma.modelos_contrato (
  cd_modelo UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nm_modelo VARCHAR(120) NOT NULL,
  ds_descricao TEXT,
  ds_conteudo TEXT NOT NULL,
  nr_versao INTEGER NOT NULL DEFAULT 1,
  sn_ativo BOOLEAN NOT NULL DEFAULT true,
  cd_criador UUID REFERENCES soma.usuarios(cd_usuario),
  cd_editor UUID REFERENCES soma.usuarios(cd_usuario),
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_modelos_contrato_ts BEFORE UPDATE ON soma.modelos_contrato
  FOR EACH ROW EXECUTE PROCEDURE soma.fn_atualizar_timestamp();

CREATE TABLE soma.modelo_contrato_versoes (
  cd_versao UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_modelo UUID NOT NULL REFERENCES soma.modelos_contrato(cd_modelo) ON DELETE CASCADE,
  nr_versao INTEGER NOT NULL,
  nm_modelo VARCHAR(120) NOT NULL,
  ds_conteudo TEXT NOT NULL,
  cd_editor UUID REFERENCES soma.usuarios(cd_usuario),
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (cd_modelo, nr_versao)
);

CREATE INDEX idx_modelo_contrato_versoes_modelo ON soma.modelo_contrato_versoes(cd_modelo);

-- ----------------------------------------------------------------
-- 3) fn_salvar_modelo_contrato — cria (p_cd_modelo NULL) ou edita.
--    Só arquiva a versão anterior e sobe nr_versao quando o TEXTO
--    muda; renomear ou mexer só na descrição não gera versão nova.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_salvar_modelo_contrato(
  p_cd_modelo UUID,
  p_nm_modelo VARCHAR,
  p_ds_descricao TEXT,
  p_ds_conteudo TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_modelo UUID;
  v_atual soma.modelos_contrato%ROWTYPE;
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico gerencia modelos de contrato.';
  END IF;

  IF p_nm_modelo IS NULL OR trim(p_nm_modelo) = '' THEN
    RAISE EXCEPTION 'Informe o nome do modelo.';
  END IF;
  IF p_ds_conteudo IS NULL OR trim(p_ds_conteudo) = '' THEN
    RAISE EXCEPTION 'O modelo não pode ficar vazio.';
  END IF;

  IF p_cd_modelo IS NULL THEN
    INSERT INTO soma.modelos_contrato (nm_modelo, ds_descricao, ds_conteudo, cd_criador, cd_editor)
    VALUES (trim(p_nm_modelo), p_ds_descricao, p_ds_conteudo, auth.uid(), auth.uid())
    RETURNING cd_modelo INTO v_cd_modelo;
    RETURN v_cd_modelo;
  END IF;

  SELECT * INTO v_atual FROM soma.modelos_contrato WHERE cd_modelo = p_cd_modelo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo não encontrado.';
  END IF;

  IF v_atual.ds_conteudo IS DISTINCT FROM p_ds_conteudo THEN
    INSERT INTO soma.modelo_contrato_versoes (cd_modelo, nr_versao, nm_modelo, ds_conteudo, cd_editor)
    VALUES (v_atual.cd_modelo, v_atual.nr_versao, v_atual.nm_modelo, v_atual.ds_conteudo, v_atual.cd_editor);

    UPDATE soma.modelos_contrato
    SET nm_modelo = trim(p_nm_modelo),
        ds_descricao = p_ds_descricao,
        ds_conteudo = p_ds_conteudo,
        nr_versao = v_atual.nr_versao + 1,
        cd_editor = auth.uid()
    WHERE cd_modelo = p_cd_modelo;
  ELSE
    UPDATE soma.modelos_contrato
    SET nm_modelo = trim(p_nm_modelo),
        ds_descricao = p_ds_descricao,
        cd_editor = auth.uid()
    WHERE cd_modelo = p_cd_modelo;
  END IF;

  RETURN p_cd_modelo;
END;
$$;

CREATE OR REPLACE FUNCTION soma.fn_arquivar_modelo_contrato(
  p_cd_modelo UUID,
  p_sn_ativo BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico gerencia modelos de contrato.';
  END IF;
  UPDATE soma.modelos_contrato SET sn_ativo = p_sn_ativo WHERE cd_modelo = p_cd_modelo;
END;
$$;

CREATE OR REPLACE FUNCTION soma.fn_excluir_modelo_contrato(p_cd_modelo UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico gerencia modelos de contrato.';
  END IF;
  DELETE FROM soma.modelos_contrato WHERE cd_modelo = p_cd_modelo;
END;
$$;

-- ----------------------------------------------------------------
-- 4) fn_gerar_minuta_de_modelo — renderiza os {{campos}} com os dados
--    do processo e cria a minuta (texto) via fn_registrar_minuta. O
--    que não dá pra preencher vira "__________" pro Jurídico completar.
--
--    Campos suportados:
--      {{numero_processo}}  {{comprador}}  {{vendedor}}
--      {{corretor}}  {{imobiliaria}}  {{data_hoje}}  {{data_extenso}}
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_gerar_minuta_de_modelo(
  p_cd_processo UUID,
  p_cd_modelo UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_processo soma.processos%ROWTYPE;
  v_conteudo TEXT;
  v_comprador TEXT;
  v_vendedor TEXT;
  v_corretor TEXT;
  v_imobiliaria TEXT;
  v_mes TEXT;
  v_data_extenso TEXT;
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

  SELECT nm_usuario INTO v_comprador FROM soma.usuarios WHERE cd_usuario = v_processo.cd_comprador;
  v_comprador := COALESCE(v_comprador, v_processo.nm_comprador_convidado, '__________');

  SELECT nm_usuario INTO v_vendedor FROM soma.usuarios WHERE cd_usuario = v_processo.cd_vendedor;
  v_vendedor := COALESCE(v_vendedor, '__________');

  SELECT nm_usuario INTO v_corretor FROM soma.usuarios WHERE cd_usuario = v_processo.cd_corretor;
  v_corretor := COALESCE(v_corretor, '__________');

  SELECT nm_imobiliaria INTO v_imobiliaria
  FROM soma.imobiliarias WHERE cd_imobiliaria = v_processo.cd_imobiliaria;
  v_imobiliaria := COALESCE(v_imobiliaria, '__________');

  v_mes := CASE extract(month FROM current_date)::int
    WHEN 1 THEN 'janeiro'   WHEN 2 THEN 'fevereiro' WHEN 3 THEN 'março'
    WHEN 4 THEN 'abril'     WHEN 5 THEN 'maio'      WHEN 6 THEN 'junho'
    WHEN 7 THEN 'julho'     WHEN 8 THEN 'agosto'    WHEN 9 THEN 'setembro'
    WHEN 10 THEN 'outubro'  WHEN 11 THEN 'novembro' WHEN 12 THEN 'dezembro'
  END;
  v_data_extenso := extract(day FROM current_date)::int || ' de ' || v_mes
    || ' de ' || extract(year FROM current_date)::int;

  v_conteudo := replace(v_conteudo, '{{numero_processo}}', v_processo.ds_numero_processo);
  v_conteudo := replace(v_conteudo, '{{comprador}}', v_comprador);
  v_conteudo := replace(v_conteudo, '{{vendedor}}', v_vendedor);
  v_conteudo := replace(v_conteudo, '{{corretor}}', v_corretor);
  v_conteudo := replace(v_conteudo, '{{imobiliaria}}', v_imobiliaria);
  v_conteudo := replace(v_conteudo, '{{data_hoje}}', to_char(current_date, 'DD/MM/YYYY'));
  v_conteudo := replace(v_conteudo, '{{data_extenso}}', v_data_extenso);

  RETURN soma.fn_registrar_minuta(p_cd_processo, NULL, v_conteudo);
END;
$$;

-- ----------------------------------------------------------------
-- 5) RLS — leitura pro time interno (a equipe precisa analisar os
--    modelos); escrita bloqueada, só as funções acima gravam.
-- ----------------------------------------------------------------
ALTER TABLE soma.modelos_contrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.modelo_contrato_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modelos_contrato_select" ON soma.modelos_contrato FOR SELECT
  USING (soma.fn_auth_role() IN ('master', 'juridico', 'gerente', 'despachante'));

CREATE POLICY "modelo_contrato_versoes_select" ON soma.modelo_contrato_versoes FOR SELECT
  USING (soma.fn_auth_role() IN ('master', 'juridico', 'gerente', 'despachante'));
