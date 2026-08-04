-- ================================================================
-- SOMA — Migration 023
-- Generaliza soma.pacote_itens pra cobrir taxas de valor VARIÁVEL
-- (Lavratura/Registro por faixa de valor) e o ITIV (3% automático),
-- além do boleto de valor fixo que já existia (migration 021).
--
-- Até aqui o botão "Pacote Compra e Venda" era hardcoded no
-- orcamento-form.tsx porque o Pacote genérico só linkava um
-- cd_custa fixo — não dava pra representar "a linha certa da
-- Tabela RI de acordo com o valor da transação". Agora dá.
--
-- tp_origem:
--   'custa' — like antes: cd_custa aponta pra uma linha fixa da
--             tabela_custas (ex: Prenotação 13043).
--   'faixa' — sem cd_custa fixo; guarda tp_tabela_faixa + nm_secao_faixa
--             e o sistema resolve a faixa certa em tempo de adição,
--             usando a base de cálculo (maior entre transação/venal).
--   'itiv'  — sem custa nenhuma; o sistema calcula 3% sobre a base
--             de cálculo direto.
--
-- tp_secao_padrao 'ambas' resolve a duplicidade de Prenotação (uma
-- cobrança nos Custos Iniciais, outra nos Finais) de forma genérica
-- pra qualquer boleto vinculado, não só pro pacote de Compra e Venda.
-- ================================================================

ALTER TABLE soma.pacote_itens ALTER COLUMN cd_custa DROP NOT NULL;

ALTER TABLE soma.pacote_itens
  ADD COLUMN tp_origem VARCHAR(10) NOT NULL DEFAULT 'custa'
    CHECK (tp_origem IN ('custa', 'faixa', 'itiv')),
  ADD COLUMN tp_tabela_faixa VARCHAR(10)
    CHECK (tp_tabela_faixa IN ('TJBA', 'RI', 'NOTAS', 'CRPN')),
  ADD COLUMN nm_secao_faixa TEXT,
  ADD COLUMN tp_secao_padrao VARCHAR(10) NOT NULL DEFAULT 'inicial'
    CHECK (tp_secao_padrao IN ('inicial', 'final', 'ambas'));

ALTER TABLE soma.pacote_itens
  ADD CONSTRAINT chk_pacote_item_origem CHECK (
    (tp_origem = 'custa' AND cd_custa IS NOT NULL AND tp_tabela_faixa IS NULL AND nm_secao_faixa IS NULL)
    OR (tp_origem = 'faixa' AND cd_custa IS NULL AND tp_tabela_faixa IS NOT NULL AND nm_secao_faixa IS NOT NULL)
    OR (tp_origem = 'itiv' AND cd_custa IS NULL AND tp_tabela_faixa IS NULL AND nm_secao_faixa IS NULL)
  );

-- Evita duplicar "faixa"/"itiv" pro mesmo serviço (a UNIQUE
-- cd_servico+cd_custa da migration 021 não pega esses casos porque
-- cd_custa fica NULL neles).
CREATE UNIQUE INDEX idx_pacote_itens_itiv_unico
  ON soma.pacote_itens (cd_servico)
  WHERE tp_origem = 'itiv';

CREATE UNIQUE INDEX idx_pacote_itens_faixa_unico
  ON soma.pacote_itens (cd_servico, tp_tabela_faixa, nm_secao_faixa, tp_secao_padrao)
  WHERE tp_origem = 'faixa';
