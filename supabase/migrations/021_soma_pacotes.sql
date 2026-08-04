-- ================================================================
-- SOMA — Migration 021
-- Tela Configurações > Pacotes: liga um serviço do catálogo (ex:
-- "Alteração de endereço do imóvel") a um ou mais boletos da tabela
-- de custas (ex: Prenotação 13043 + Averbação 09016), pra que, ao
-- adicionar aquele serviço num orçamento, os boletos vinculados
-- entrem automaticamente junto — sem o operador ter que lembrar/
-- procurar os códigos manualmente toda vez.
--
-- sn_opcional marca um item do pacote como sugestão (entra marcado
-- "(opcional)" na descrição, mas é adicionado igual — o operador
-- remove na hora se não precisar daquele orçamento específico).
-- ================================================================

CREATE TABLE soma.pacote_itens (
  cd_pacote_item UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_servico UUID NOT NULL REFERENCES soma.servicos(cd_servico) ON DELETE CASCADE,
  cd_custa UUID NOT NULL REFERENCES soma.tabela_custas(cd_custa) ON DELETE CASCADE,
  sn_opcional BOOLEAN NOT NULL DEFAULT false,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (cd_servico, cd_custa)
);

CREATE INDEX idx_pacote_itens_servico ON soma.pacote_itens(cd_servico);

ALTER TABLE soma.pacote_itens ENABLE ROW LEVEL SECURITY;

-- Leitura livre (o formulário de orçamento precisa ler pra saber o
-- que auto-adicionar), escrita só Master.
CREATE POLICY "pacote_itens_select" ON soma.pacote_itens FOR SELECT
  USING (true);

CREATE POLICY "pacote_itens_insert" ON soma.pacote_itens FOR INSERT
  WITH CHECK (soma.fn_auth_role() = 'master');

CREATE POLICY "pacote_itens_delete" ON soma.pacote_itens FOR DELETE
  USING (soma.fn_auth_role() = 'master');
