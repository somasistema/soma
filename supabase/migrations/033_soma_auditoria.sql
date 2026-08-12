-- ================================================================
-- SOMA — Migration 033
-- Log de auditoria genérico — trava (registra) toda mudança feita em
-- INSERT/UPDATE/DELETE nas tabelas que importam, com quem fez, o
-- que mudou (antes/depois em JSON) e quando. Só Master lê.
--
-- Mecanismo: uma função de trigger genérica (soma.fn_log_auditoria),
-- parametrizada com o nome da coluna de PK de cada tabela via
-- TG_ARGV[0], anexada a cada tabela que precisa de rastro. auth.uid()
-- funciona certo aqui porque o trigger roda na MESMA transação da
-- operação que disparou ele — pega o usuário autenticado da sessão
-- de quem fez o INSERT/UPDATE/DELETE.
--
-- soma.usuarios é a ÚNICA exceção: toda escrita ali passa por
-- service_role (fora do contexto de sessão do usuário logado), então
-- em vez de trigger, o próprio código da aplicação grava o log
-- explicitamente (usuarios/actions.ts já sabe quem é o Master agindo).
-- ================================================================

CREATE TABLE soma.log_auditoria (
  cd_log UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_usuario UUID REFERENCES soma.usuarios(cd_usuario) ON DELETE SET NULL,
  nm_tabela VARCHAR(60) NOT NULL,
  tp_operacao VARCHAR(10) NOT NULL CHECK (tp_operacao IN ('INSERT', 'UPDATE', 'DELETE')),
  cd_registro TEXT,
  dados_antigos JSONB,
  dados_novos JSONB,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_log_auditoria_tabela ON soma.log_auditoria(nm_tabela);
CREATE INDEX idx_log_auditoria_registro ON soma.log_auditoria(cd_registro);
CREATE INDEX idx_log_auditoria_ts ON soma.log_auditoria(ts_criacao DESC);
CREATE INDEX idx_log_auditoria_usuario ON soma.log_auditoria(cd_usuario);

ALTER TABLE soma.log_auditoria ENABLE ROW LEVEL SECURITY;

-- Só Master lê. Sem policy de INSERT/UPDATE/DELETE pra ninguém via
-- API — só o trigger (SECURITY DEFINER) e o código server-only com
-- service_role escrevem aqui. Ninguém apaga rastro pela API.
CREATE POLICY "log_auditoria_select" ON soma.log_auditoria FOR SELECT
  USING (soma.fn_auth_role() = 'master');

CREATE OR REPLACE FUNCTION soma.fn_log_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_pk_coluna TEXT := TG_ARGV[0];
  v_cd_registro TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_cd_registro := (to_jsonb(OLD) ->> v_pk_coluna);
  ELSE
    v_cd_registro := (to_jsonb(NEW) ->> v_pk_coluna);
  END IF;

  INSERT INTO soma.log_auditoria (cd_usuario, nm_tabela, tp_operacao, cd_registro, dados_antigos, dados_novos)
  VALUES (
    auth.uid(),
    TG_TABLE_NAME,
    TG_OP,
    v_cd_registro,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('UPDATE', 'INSERT') THEN to_jsonb(NEW) ELSE NULL END
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Processos e tudo que gira em torno de processo/orçamento
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.processos
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_processo');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.orcamentos
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_orcamento');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.orcamento_servicos
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_orcamento_servico');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.pendencias
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_pendencia');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.documentos
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_documento');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.andamentos
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_andamento');

-- Catálogo/configuração (Serviços, Taxas e Emolumentos, Pacotes,
-- Cidades, Fluxo, Perfil de acesso, Imobiliárias)
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.servicos
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_servico');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.servico_precos
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_servico_preco');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.tabela_custas
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_custa');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.pacote_itens
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_pacote_item');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.cidades
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_cidade');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.fluxo_blocos
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_bloco');

-- perfil_acesso tem PK composta (tp_role, cd_secao) — usa cd_secao
-- como identificador de conveniência; dados_antigos/dados_novos têm
-- o registro completo (com tp_role incluso) de qualquer forma.
CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.perfil_acesso
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_secao');

CREATE TRIGGER trg_auditoria AFTER INSERT OR UPDATE OR DELETE ON soma.imobiliarias
  FOR EACH ROW EXECUTE FUNCTION soma.fn_log_auditoria('cd_imobiliaria');
