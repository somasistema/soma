  -- ================================================================
  -- SOMA — Migration 082
  -- Consultas externas pagas (certidões e protesto) feitas pela equipe.
  --
  --   * soma.consultas_externas: guarda o resultado de cada consulta para a
  --     equipe não pagar duas vezes pelo mesmo documento. Cada linha é uma
  --     consulta de uma parte (ou do imóvel) de um processo.
  --   * Só guarda o resumo do resultado (situação, validade, protestos),
  --     nunca o cadastro completo devolvido pelo fornecedor.
  --   * Leitura só para Master e Jurídico (tem dado pessoal: protesto,
  --     dívida). Escrita só pelo servidor (service_role), depois de checar
  --     o perfil, como na vistoria.
  --
  -- Rodar depois da 081.
  -- ================================================================

  CREATE TABLE IF NOT EXISTS soma.consultas_externas (
    cd_consulta UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
    -- Parte consultada; fica nula se a parte sair do processo (o histórico fica).
    cd_parte UUID REFERENCES soma.processo_parte(cd_parte) ON DELETE SET NULL,
    -- certidao_federal | certidao_estadual | protesto | cnd_municipal | nada_consta_municipal
    tp_consulta VARCHAR(40) NOT NULL,
    ds_fornecedor VARCHAR(40) NOT NULL,
    -- CPF, CNPJ ou inscrição consultada, só dígitos.
    ds_documento VARCHAR(30) NOT NULL,
    ds_uf CHAR(2),
    -- negativa | com_efeitos | positiva | desconhecido
    tp_resultado VARCHAR(20) NOT NULL DEFAULT 'desconhecido',
    ds_resumo TEXT,
    dt_validade DATE,
    -- Resumo do que o fornecedor devolveu (sem cadastro completo da pessoa).
    js_dados JSONB,
    vl_custo NUMERIC(10, 2) NOT NULL DEFAULT 0,
    -- true = veio da base de teste do fornecedor: não vale como consulta real.
    sn_homologacao BOOLEAN NOT NULL DEFAULT false,
    cd_usuario UUID,
    ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_consultas_externas_processo
    ON soma.consultas_externas(cd_processo, ts_criacao DESC);
  CREATE INDEX IF NOT EXISTS idx_consultas_externas_parte
    ON soma.consultas_externas(cd_parte, tp_consulta, ts_criacao DESC);

  ALTER TABLE soma.consultas_externas ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "consultas_externas_select" ON soma.consultas_externas;
  CREATE POLICY "consultas_externas_select" ON soma.consultas_externas FOR SELECT
    USING (soma.fn_auth_role() IN ('master', 'juridico'));
