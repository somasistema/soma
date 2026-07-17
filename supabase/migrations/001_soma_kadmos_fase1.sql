-- ================================================================
-- PLATAFORMA SOMA — ARQUITETURA KADMOS (FASE 1)
-- ================================================================

-- ----------------------------------------------------------------
-- 0. SETUP DO SCHEMA E FUNÇÕES DE INFRAESTRUTURA
-- ----------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS soma;

CREATE OR REPLACE FUNCTION soma.fn_atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.ts_atualizacao = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------
-- 1. TIPAGEM FORTE (ENUMS)
-- ----------------------------------------------------------------
CREATE TYPE soma.type_user_role AS ENUM (
  'master', 'juridico', 'imobiliaria', 'despachante',
  'corretor', 'vendedor', 'comprador', 'outro_cliente'
);

CREATE TYPE soma.type_processo AS ENUM (
  'a_vista', 'financiamento', 'consorcio', 'locacao', 'averbacao', 'inventario'
);

CREATE TYPE soma.type_orcamento_status AS ENUM (
  'pendente', 'aceito', 'pago', 'liberado', 'reprovado'
);

CREATE TYPE soma.type_servico AS ENUM ('honorario', 'custa');

CREATE TYPE soma.type_metodo_pagamento AS ENUM ('pix', 'cartao');

CREATE TYPE soma.type_status_pagamento AS ENUM ('pendente', 'confirmado', 'estornado', 'falhou');

CREATE TYPE soma.type_status_documento AS ENUM ('pendente', 'validado', 'rejeitado');

CREATE TYPE soma.type_perfil_documento AS ENUM ('comprador', 'vendedor', 'imovel', 'outro');

CREATE TYPE soma.type_status_pendencia AS ENUM ('aberta', 'concluida', 'atrasada');

-- ----------------------------------------------------------------
-- 2. TABELAS BASE (CORE & ENTIDADES)
-- ----------------------------------------------------------------
CREATE TABLE soma.imobiliarias (
  cd_imobiliaria UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nm_imobiliaria VARCHAR(255) NOT NULL,
  ds_cnpj VARCHAR(20),
  ds_telefone VARCHAR(20),
  ds_email VARCHAR(150),
  sn_ativo BOOLEAN DEFAULT true NOT NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE soma.usuarios (
  cd_usuario UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nm_usuario VARCHAR(255) NOT NULL,
  ds_email VARCHAR(150) NOT NULL,
  ds_telefone VARCHAR(20),
  tp_role soma.type_user_role NOT NULL,
  cd_imobiliaria UUID REFERENCES soma.imobiliarias(cd_imobiliaria),
  sn_ativo BOOLEAN DEFAULT true NOT NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_usuarios_role ON soma.usuarios(tp_role);
CREATE INDEX idx_usuarios_imobiliaria ON soma.usuarios(cd_imobiliaria);

CREATE TABLE soma.servicos (
  cd_servico UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nm_servico VARCHAR(200) NOT NULL,
  ds_descricao TEXT,
  tp_servico soma.type_servico NOT NULL,
  vl_servico NUMERIC(15,2) NOT NULL,
  sn_ativo BOOLEAN DEFAULT true NOT NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TRIGGER trg_servicos_ts BEFORE UPDATE ON soma.servicos
  FOR EACH ROW EXECUTE PROCEDURE soma.fn_atualizar_timestamp();

-- ----------------------------------------------------------------
-- 3. MOTOR DE PROCESSOS E OPERAÇÃO
-- ----------------------------------------------------------------
CREATE SEQUENCE soma.seq_numero_processo START 1;

CREATE TABLE soma.processos (
  cd_processo UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ds_numero_processo VARCHAR(50) UNIQUE NOT NULL,
  tp_processo soma.type_processo NOT NULL,

  cd_imobiliaria UUID REFERENCES soma.imobiliarias(cd_imobiliaria),
  cd_comprador UUID REFERENCES soma.usuarios(cd_usuario),
  cd_vendedor UUID REFERENCES soma.usuarios(cd_usuario),
  cd_corretor UUID REFERENCES soma.usuarios(cd_usuario),
  cd_despachante UUID REFERENCES soma.usuarios(cd_usuario),

  ds_observacoes_juridicas TEXT,

  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_processos_atores ON soma.processos(cd_imobiliaria, cd_comprador, cd_despachante);

CREATE TRIGGER trg_processos_ts BEFORE UPDATE ON soma.processos
  FOR EACH ROW EXECUTE PROCEDURE soma.fn_atualizar_timestamp();

CREATE OR REPLACE FUNCTION soma.fn_gerar_numero_processo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.ds_numero_processo := 'SOMA-' || extract(year from now())::text || '-' ||
    lpad(nextval('soma.seq_numero_processo')::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_processo_numero
BEFORE INSERT ON soma.processos
FOR EACH ROW WHEN (NEW.ds_numero_processo IS NULL)
EXECUTE PROCEDURE soma.fn_gerar_numero_processo();

-- ----------------------------------------------------------------
-- 4. MOTOR FINANCEIRO
-- ----------------------------------------------------------------
CREATE TABLE soma.orcamentos (
  cd_orcamento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  cd_criador UUID NOT NULL REFERENCES soma.usuarios(cd_usuario),

  nm_cidade VARCHAR(150) NOT NULL,
  dt_validade DATE NOT NULL,
  tp_status soma.type_orcamento_status DEFAULT 'pendente' NOT NULL,

  vl_total_honorarios NUMERIC(15,2) DEFAULT 0 NOT NULL,
  vl_total_custas NUMERIC(15,2) DEFAULT 0 NOT NULL,
  vl_total_geral NUMERIC(15,2) GENERATED ALWAYS AS (vl_total_honorarios + vl_total_custas) STORED,

  ds_pdf_url TEXT,
  cd_token_aceite UUID DEFAULT gen_random_uuid() UNIQUE,
  ts_aceite TIMESTAMPTZ,

  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_orcamentos_processo ON soma.orcamentos(cd_processo, tp_status);

CREATE TRIGGER trg_orcamentos_ts BEFORE UPDATE ON soma.orcamentos
  FOR EACH ROW EXECUTE PROCEDURE soma.fn_atualizar_timestamp();

CREATE TABLE soma.orcamento_servicos (
  cd_orcamento_servico UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_orcamento UUID NOT NULL REFERENCES soma.orcamentos(cd_orcamento) ON DELETE CASCADE,
  cd_servico UUID REFERENCES soma.servicos(cd_servico),

  ds_descricao VARCHAR(255) NOT NULL,
  tp_servico soma.type_servico NOT NULL,
  vl_unitario NUMERIC(15,2) NOT NULL,
  nr_quantidade INTEGER DEFAULT 1 NOT NULL,
  vl_subtotal NUMERIC(15,2) GENERATED ALWAYS AS (vl_unitario * nr_quantidade) STORED
);

CREATE INDEX idx_orc_serv_orcamento ON soma.orcamento_servicos(cd_orcamento);

CREATE TABLE soma.pagamentos (
  cd_pagamento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_orcamento UUID NOT NULL REFERENCES soma.orcamentos(cd_orcamento) ON DELETE CASCADE,

  ds_mercadopago_payment_id VARCHAR(100),
  ds_webhook_id VARCHAR(255) UNIQUE,

  tp_metodo soma.type_metodo_pagamento NOT NULL,
  nr_parcelas INTEGER DEFAULT 1,
  vl_pagamento NUMERIC(15,2) NOT NULL,
  tp_status soma.type_status_pagamento DEFAULT 'pendente' NOT NULL,

  ds_qr_code TEXT,
  ts_confirmacao TIMESTAMPTZ,

  cd_liberador UUID REFERENCES soma.usuarios(cd_usuario),
  ts_liberacao TIMESTAMPTZ,

  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ----------------------------------------------------------------
-- 5. GESTÃO DOCUMENTAL E WORKFLOW
-- ----------------------------------------------------------------
CREATE TABLE soma.documentos (
  cd_documento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  cd_enviado_por UUID REFERENCES soma.usuarios(cd_usuario),

  tp_perfil_alvo soma.type_perfil_documento NOT NULL,
  nm_tipo_documento VARCHAR(100) NOT NULL,
  nm_arquivo VARCHAR(255) NOT NULL,
  ds_storage_url TEXT NOT NULL,

  tp_status soma.type_status_documento DEFAULT 'pendente' NOT NULL,
  cd_validador UUID REFERENCES soma.usuarios(cd_usuario),
  ts_validacao TIMESTAMPTZ,
  ds_observacoes TEXT,

  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE TABLE soma.pendencias (
  cd_pendencia UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  cd_responsavel UUID REFERENCES soma.usuarios(cd_usuario),

  ds_pendencia TEXT NOT NULL,
  dt_prazo DATE,
  tp_status soma.type_status_pendencia DEFAULT 'aberta' NOT NULL,

  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_conclusao TIMESTAMPTZ
);

CREATE TABLE soma.andamentos (
  cd_andamento UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  cd_despachante UUID NOT NULL REFERENCES soma.usuarios(cd_usuario),

  nm_etapa VARCHAR(150) NOT NULL,
  ds_andamento TEXT NOT NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ================================================================
-- 6. SEGURANÇA E MOTOR RLS (CORRIGIDO)
-- ================================================================
ALTER TABLE soma.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION soma.fn_auth_role()
RETURNS soma.type_user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
  SELECT tp_role FROM soma.usuarios WHERE cd_usuario = auth.uid() LIMIT 1;
$$;

CREATE POLICY "usuarios_select" ON soma.usuarios FOR SELECT
  USING (cd_usuario = auth.uid() OR soma.fn_auth_role() = 'master');

CREATE POLICY "processos_select" ON soma.processos FOR SELECT
  USING (
    soma.fn_auth_role() IN ('master', 'juridico')
    OR cd_comprador = auth.uid()
    OR cd_vendedor = auth.uid()
    OR cd_corretor = auth.uid()
    OR cd_despachante = auth.uid()
    OR cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
  );

CREATE POLICY "orcamentos_select" ON soma.orcamentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.processos p
      WHERE p.cd_processo = orcamentos.cd_processo
      AND (
        soma.fn_auth_role() IN ('master', 'juridico')
        OR p.cd_comprador = auth.uid()
        OR p.cd_vendedor = auth.uid()
        OR p.cd_corretor = auth.uid()
        OR p.cd_despachante = auth.uid()
        OR p.cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
      )
    )
  );

CREATE POLICY "orcamentos_insert" ON soma.orcamentos FOR INSERT
  WITH CHECK (soma.fn_auth_role() IN ('master', 'juridico'));

CREATE POLICY "orcamentos_update" ON soma.orcamentos FOR UPDATE
  USING (
    soma.fn_auth_role() IN ('master', 'juridico')
    OR (
      soma.fn_auth_role() = 'imobiliaria'
      AND tp_status = 'pago'
      AND EXISTS (
        SELECT 1 FROM soma.processos p
        WHERE p.cd_processo = orcamentos.cd_processo
        AND p.cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
      )
    )
  )
  WITH CHECK (
    soma.fn_auth_role() IN ('master', 'juridico')
    OR (
      soma.fn_auth_role() = 'imobiliaria'
      AND tp_status IN ('pago', 'liberado')
      AND EXISTS (
        SELECT 1 FROM soma.processos p
        WHERE p.cd_processo = orcamentos.cd_processo
        AND p.cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
      )
    )
  );
