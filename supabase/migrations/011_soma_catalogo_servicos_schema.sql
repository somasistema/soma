-- ================================================================
-- SOMA — Migration 011
-- Suporte ao catálogo real de serviços do despachante (planilha
-- "Valores Serviços Despachante"): cada serviço agora pertence a um
-- LOCAL (órgão/cartório: CRI, NOTAS, RCPN, SEFAZ, SEDUR, RF, TJ, TRT,
-- TRF, SOMA) e uma categoria (TIPO — Averbação, Certidão, Registro...),
-- e o preço passa a variar por cidade (Salvador, Lauro de Freitas,
-- Camaçari), em vez de um valor único.
--
-- soma.servicos.vl_servico é removida — o preço agora vive em
-- soma.servico_precos, uma linha por (serviço, cidade). Serviços cujo
-- valor não é fixo (ex: "Atos imobiliários por faixa", que seguem a
-- tabela de emolumentos do TJBA em vez de um preço do despachante)
-- entram com sn_valor_variavel = true e nenhuma linha de preço — quem
-- monta o orçamento digita o valor manualmente nesse caso.
-- ================================================================

ALTER TABLE soma.servicos
  ADD COLUMN cd_codigo VARCHAR(20),
  ADD COLUMN tp_local VARCHAR(10),
  ADD COLUMN nm_categoria VARCHAR(60),
  ADD COLUMN ds_checklist TEXT,
  ADD COLUMN sn_valor_variavel BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE soma.servicos DROP COLUMN vl_servico;

CREATE TABLE soma.servico_precos (
  cd_servico_preco UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_servico UUID NOT NULL REFERENCES soma.servicos(cd_servico) ON DELETE CASCADE,
  nm_cidade VARCHAR(80) NOT NULL,
  vl_valor NUMERIC(15,2) NOT NULL,
  UNIQUE (cd_servico, nm_cidade)
);

ALTER TABLE soma.servico_precos ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de soma.servicos: leitura livre (precisa pra montar
-- orçamento), escrita só pelo Master.
CREATE POLICY "servico_precos_select" ON soma.servico_precos FOR SELECT
  USING (true);

CREATE POLICY "servico_precos_insert" ON soma.servico_precos FOR INSERT
  WITH CHECK (soma.fn_auth_role() = 'master');

CREATE POLICY "servico_precos_update" ON soma.servico_precos FOR UPDATE
  USING (soma.fn_auth_role() = 'master');

CREATE POLICY "servico_precos_delete" ON soma.servico_precos FOR DELETE
  USING (soma.fn_auth_role() = 'master');

-- Os 3 serviços de exemplo/teste cadastrados antes desta migration não
-- têm código/local/categoria da planilha real — desativa em vez de
-- apagar (preserva histórico de orçamentos antigos que os referenciam).
UPDATE soma.servicos SET sn_ativo = false WHERE tp_local IS NULL;
