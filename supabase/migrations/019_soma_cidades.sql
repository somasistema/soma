-- ================================================================
-- SOMA — Migration 019
-- Cidades atendidas deixam de ser uma lista fixa no código (só
-- Salvador/Lauro de Freitas/Camaçari) e passam a ser cadastráveis em
-- Configurações > Cidades. soma.servico_precos.nm_cidade continua um
-- texto livre (sem FK) — essa tabela é só a fonte das opções que
-- aparecem nos formulários, não trava preços já cadastrados se uma
-- cidade for removida depois.
-- ================================================================

CREATE TABLE soma.cidades (
  cd_cidade UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nm_cidade VARCHAR(80) UNIQUE NOT NULL,
  sn_ativo BOOLEAN NOT NULL DEFAULT true,
  nr_ordem INTEGER NOT NULL DEFAULT 0,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

ALTER TABLE soma.cidades ENABLE ROW LEVEL SECURITY;

-- Leitura livre (todo formulário de orçamento/serviço precisa listar
-- cidades), escrita só Master.
CREATE POLICY "cidades_select" ON soma.cidades FOR SELECT
  USING (true);

CREATE POLICY "cidades_insert" ON soma.cidades FOR INSERT
  WITH CHECK (soma.fn_auth_role() = 'master');

CREATE POLICY "cidades_update" ON soma.cidades FOR UPDATE
  USING (soma.fn_auth_role() = 'master');

CREATE POLICY "cidades_delete" ON soma.cidades FOR DELETE
  USING (soma.fn_auth_role() = 'master');

INSERT INTO soma.cidades (nm_cidade, nr_ordem) VALUES
  ('Salvador', 10),
  ('Lauro de Freitas', 20),
  ('Camaçari', 30);
