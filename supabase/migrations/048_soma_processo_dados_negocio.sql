-- ================================================================
-- SOMA — Migration 048
-- Dados do negócio capturados na abertura do processo de contrato —
-- o questionário "Informações para contrato de compra e venda" que o
-- Jurídico preenche hoje num .pdf à mão.
--
--   soma.processo_negocio  (1:1) — imóvel + honorários
--   soma.processo_parte    (1:N) — vendedores e compradores
--   soma.processo_corretor (1:N) — corretores e seus honorários
--
-- Escrita só via fn_salvar_dados_negocio / fn_criar_processo_contrato
-- (SECURITY DEFINER, Master/Jurídico). Leitura acompanha quem já
-- enxerga o processo.
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Tabelas
-- ----------------------------------------------------------------
CREATE TABLE soma.processo_negocio (
  cd_processo UUID PRIMARY KEY REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  vl_imovel NUMERIC(15, 2),
  vl_entrada NUMERIC(15, 2),
  vl_financiamento NUMERIC(15, 2),
  ds_banco VARCHAR(120),
  sn_possui_inquilino BOOLEAN,
  sn_ocupado BOOLEAN,
  ds_entrega_chaves TEXT,
  ds_itens_imovel TEXT,
  vl_honorarios_total NUMERIC(15, 2),
  ds_honorarios_quando TEXT,
  vl_honorarios_imobiliaria NUMERIC(15, 2),
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE soma.processo_parte (
  cd_parte UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  tp_lado VARCHAR(10) NOT NULL CHECK (tp_lado IN ('vendedor', 'comprador')),
  nr_ordem INTEGER NOT NULL DEFAULT 0,
  nm_parte VARCHAR(255) NOT NULL,
  ds_telefone VARCHAR(30),
  ds_email VARCHAR(255),
  ds_profissao VARCHAR(120),
  ds_conta_bancaria VARCHAR(255),
  -- checklist do intake: 'ok' | 'falta' | 'ressalva' (com observação)
  tp_doc_identidade VARCHAR(12) CHECK (tp_doc_identidade IN ('ok', 'falta', 'ressalva')),
  tp_doc_estado_civil VARCHAR(12) CHECK (tp_doc_estado_civil IN ('ok', 'falta', 'ressalva')),
  tp_doc_comprovante_residencia VARCHAR(12)
    CHECK (tp_doc_comprovante_residencia IN ('ok', 'falta', 'ressalva')),
  tp_doc_onus_escritura VARCHAR(12) CHECK (tp_doc_onus_escritura IN ('ok', 'falta', 'ressalva')),
  ds_documentos_obs TEXT
);

CREATE INDEX idx_processo_parte_processo ON soma.processo_parte(cd_processo);

CREATE TABLE soma.processo_corretor (
  cd_processo_corretor UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  nm_corretor VARCHAR(255) NOT NULL,
  vl_honorario NUMERIC(15, 2),
  ds_lado VARCHAR(20)
);

CREATE INDEX idx_processo_corretor_processo ON soma.processo_corretor(cd_processo);

-- ----------------------------------------------------------------
-- 2) fn_salvar_dados_negocio — grava o bloco 1:1 e regrava as listas
--    de partes/corretores (delete + insert). Também serve pra editar
--    depois, pela tela do processo.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_salvar_dados_negocio(
  p_cd_processo UUID,
  p_negocio JSONB,
  p_partes JSONB,
  p_corretores JSONB
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
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
    vl_honorarios_total, ds_honorarios_quando, vl_honorarios_imobiliaria
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
    NULLIF(p_negocio->>'vl_honorarios_total', '')::numeric,
    NULLIF(p_negocio->>'ds_honorarios_quando', ''),
    NULLIF(p_negocio->>'vl_honorarios_imobiliaria', '')::numeric
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
    vl_honorarios_total = EXCLUDED.vl_honorarios_total,
    ds_honorarios_quando = EXCLUDED.ds_honorarios_quando,
    vl_honorarios_imobiliaria = EXCLUDED.vl_honorarios_imobiliaria,
    ts_atualizacao = now();

  DELETE FROM soma.processo_parte WHERE cd_processo = p_cd_processo;
  INSERT INTO soma.processo_parte (
    cd_processo, tp_lado, nr_ordem, nm_parte, ds_telefone, ds_email,
    ds_profissao, ds_conta_bancaria, tp_doc_identidade, tp_doc_estado_civil,
    tp_doc_comprovante_residencia, tp_doc_onus_escritura, ds_documentos_obs
  )
  SELECT
    p_cd_processo,
    parte->>'tp_lado',
    COALESCE((parte->>'nr_ordem')::int, 0),
    parte->>'nm_parte',
    NULLIF(parte->>'ds_telefone', ''),
    NULLIF(parte->>'ds_email', ''),
    NULLIF(parte->>'ds_profissao', ''),
    NULLIF(parte->>'ds_conta_bancaria', ''),
    NULLIF(parte->>'tp_doc_identidade', ''),
    NULLIF(parte->>'tp_doc_estado_civil', ''),
    NULLIF(parte->>'tp_doc_comprovante_residencia', ''),
    NULLIF(parte->>'tp_doc_onus_escritura', ''),
    NULLIF(parte->>'ds_documentos_obs', '')
  FROM jsonb_array_elements(COALESCE(p_partes, '[]'::jsonb)) AS parte
  WHERE NULLIF(trim(parte->>'nm_parte'), '') IS NOT NULL;

  DELETE FROM soma.processo_corretor WHERE cd_processo = p_cd_processo;
  INSERT INTO soma.processo_corretor (cd_processo, nm_corretor, vl_honorario, ds_lado)
  SELECT
    p_cd_processo,
    corretor->>'nm_corretor',
    NULLIF(corretor->>'vl_honorario', '')::numeric,
    NULLIF(corretor->>'ds_lado', '')
  FROM jsonb_array_elements(COALESCE(p_corretores, '[]'::jsonb)) AS corretor
  WHERE NULLIF(trim(corretor->>'nm_corretor'), '') IS NOT NULL;
END;
$$;

-- ----------------------------------------------------------------
-- 3) fn_criar_processo_contrato — cria o processo e já grava o
--    questionário, numa transação só.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_criar_processo_contrato(
  p_cd_imobiliaria UUID,
  p_nm_comprador_convidado VARCHAR,
  p_ds_telefone_comprador_convidado VARCHAR,
  p_negocio JSONB,
  p_partes JSONB,
  p_corretores JSONB
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
BEGIN
  v_cd_processo := soma.fn_criar_processo(
    p_cd_imobiliaria,
    p_nm_comprador_convidado,
    p_ds_telefone_comprador_convidado,
    NULL,
    NULL
  );

  PERFORM soma.fn_salvar_dados_negocio(v_cd_processo, p_negocio, p_partes, p_corretores);

  RETURN v_cd_processo;
END;
$$;

-- ----------------------------------------------------------------
-- 4) RLS — leitura pra quem vê o processo; escrita só pelas funções.
-- ----------------------------------------------------------------
ALTER TABLE soma.processo_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.processo_parte ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.processo_corretor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "processo_negocio_select" ON soma.processo_negocio FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));

CREATE POLICY "processo_parte_select" ON soma.processo_parte FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));

CREATE POLICY "processo_corretor_select" ON soma.processo_corretor FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));
