-- ================================================================
-- SOMA — Migration 017
-- Tela Configurações > Fluxo: editor visual (canvas) dos blocos que
-- aparecem na tela de novo orçamento. Cada bloco guarda posição no
-- canvas (só visual, não muda a ordem/dependência real dos campos)
-- e se está ativo — desativado, o bloco some de /orcamentos/novo de
-- verdade, não é só uma maquete.
--
-- cd_bloco é fixo (só estes 6 existem hoje, um por card do formulário
-- de novo orçamento) — sem INSERT/DELETE pela aplicação, só UPDATE de
-- posição/ativo.
-- ================================================================

CREATE TABLE soma.fluxo_blocos (
  cd_bloco VARCHAR(40) PRIMARY KEY,
  nm_bloco VARCHAR(80) NOT NULL,
  sn_ativo BOOLEAN NOT NULL DEFAULT true,
  posicao_x NUMERIC NOT NULL DEFAULT 0,
  posicao_y NUMERIC NOT NULL DEFAULT 0,
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE soma.fluxo_blocos ENABLE ROW LEVEL SECURITY;

-- Leitura livre (o formulário de orçamento precisa ler pra saber o
-- que mostrar, pra qualquer usuário que cria orçamento). Escrita só
-- Master.
CREATE POLICY "fluxo_blocos_select" ON soma.fluxo_blocos FOR SELECT
  USING (true);

CREATE POLICY "fluxo_blocos_update" ON soma.fluxo_blocos FOR UPDATE
  USING (soma.fn_auth_role() = 'master');

CREATE TRIGGER trg_fluxo_blocos_ts BEFORE UPDATE ON soma.fluxo_blocos
  FOR EACH ROW EXECUTE PROCEDURE soma.fn_atualizar_timestamp();

INSERT INTO soma.fluxo_blocos (cd_bloco, nm_bloco, posicao_x, posicao_y) VALUES
  ('tipo_processo', 'Tipo de Processo', 40, 40),
  ('informacoes_basicas', 'Informações Básicas', 320, 40),
  ('orgao', 'Órgão / Local do Serviço', 600, 40),
  ('tipo_servico', 'Tipo de Serviço', 600, 220),
  ('selecao_servicos', 'Seleção de Serviços', 880, 130),
  ('boletos', 'Boletos (Custas)', 1160, 130);
