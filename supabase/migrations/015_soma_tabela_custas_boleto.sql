-- ================================================================
-- SOMA — Migration 015
-- Tela "Boleto": catálogo de consulta das tabelas oficiais de custas
-- do TJBA (Decreto Judiciário nº 1075/2025, vigência 01/01/2026) —
-- Tabela I (Cartórios Judiciais / Tribunal), Tabela II (Tabelionato
-- de Notas), Tabela III (Registro de Imóveis) e Tabela VI (Registro
-- Civil das Pessoas Naturais). Por enquanto é só consulta — não entra
-- no cálculo do orçamento ainda (isso fica pra uma etapa seguinte).
--
-- Muitos atos têm valor por FAIXA (ex: "de R$1.500,01 a R$2.500,00 →
-- R$363,98"), por isso vl_faixa_min/vl_faixa_max ficam guardados fiéis
-- à tabela oficial em vez de simplificar pra um valor único. Alguns
-- atos não têm valor monetário (ex: "Gratuita", "Conforme Tarifas
-- Correios") — nesses casos vl_pagar fica NULL e ds_valor_especial
-- guarda o texto.
-- ================================================================

CREATE TABLE soma.tabela_custas (
  cd_custa UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tp_tabela VARCHAR(10) NOT NULL CHECK (tp_tabela IN ('TJBA', 'RI', 'NOTAS', 'CRPN')),
  nm_secao VARCHAR(150) NOT NULL,
  ds_ato TEXT NOT NULL,
  cd_ato VARCHAR(10),
  vl_faixa_min NUMERIC(15,2),
  vl_faixa_max NUMERIC(15,2),
  vl_pagar NUMERIC(15,2),
  ds_valor_especial VARCHAR(60),
  nr_ordem INTEGER NOT NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_tabela_custas_tp_tabela ON soma.tabela_custas(tp_tabela);

ALTER TABLE soma.tabela_custas ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de soma.servicos: leitura livre pra todo autenticado,
-- escrita só pelo Master (dado oficial, atualizado via migration).
CREATE POLICY "tabela_custas_select" ON soma.tabela_custas FOR SELECT
  USING (true);

CREATE POLICY "tabela_custas_insert" ON soma.tabela_custas FOR INSERT
  WITH CHECK (soma.fn_auth_role() = 'master');

CREATE POLICY "tabela_custas_update" ON soma.tabela_custas FOR UPDATE
  USING (soma.fn_auth_role() = 'master');

CREATE POLICY "tabela_custas_delete" ON soma.tabela_custas FOR DELETE
  USING (soma.fn_auth_role() = 'master');

-- ----------------------------------------------------------------
-- TABELA I — TJBA (Cartórios Judiciais / Tribunal)
-- ----------------------------------------------------------------

-- I - Das causas em geral e processos de competência originária do TJ
INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_faixa_min, vl_faixa_max, vl_pagar, nr_ordem) VALUES
('TJBA', 'I - Causas em geral', 'Até R$ 1.500,00', '32069', NULL, 1500.00, 211.02, 10),
('TJBA', 'I - Causas em geral', 'De R$ 1.500,01 a R$ 2.500,00', '32077', 1500.01, 2500.00, 363.98, 20),
('TJBA', 'I - Causas em geral', 'De R$ 2.500,01 a R$ 4.000,00', '32085', 2500.01, 4000.00, 567.78, 30),
('TJBA', 'I - Causas em geral', 'De R$ 4.000,01 a R$ 6.000,00', '32090', 4000.01, 6000.00, 844.40, 40),
('TJBA', 'I - Causas em geral', 'De R$ 6.000,01 a R$ 8.000,00', '32093', 6000.01, 8000.00, 1091.94, 50),
('TJBA', 'I - Causas em geral', 'De R$ 8.000,01 a R$ 11.000,00', '32100', 8000.01, 11000.00, 1310.32, 60),
('TJBA', 'I - Causas em geral', 'De R$ 11.000,01 a R$ 15.000,00', '32107', 11000.01, 15000.00, 1601.54, 70),
('TJBA', 'I - Causas em geral', 'De R$ 15.000,01 a R$ 19.000,00', '32110', 15000.01, 19000.00, 1892.70, 80),
('TJBA', 'I - Causas em geral', 'De R$ 19.000,01 a R$ 23.000,00', '32115', 19000.01, 23000.00, 2183.88, 90),
('TJBA', 'I - Causas em geral', 'De R$ 23.000,01 a R$ 28.000,00', '32120', 23000.01, 28000.00, 2475.06, 100),
('TJBA', 'I - Causas em geral', 'De R$ 28.000,01 a R$ 35.000,00', '32123', 28000.01, 35000.00, 2728.22, 110),
('TJBA', 'I - Causas em geral', 'De R$ 35.000,01 a R$ 45.000,00', '32127', 35000.01, 45000.00, 3288.56, 120),
('TJBA', 'I - Causas em geral', 'De R$ 45.000,01 a R$ 60.000,00', '32131', 45000.01, 60000.00, 3737.94, 130),
('TJBA', 'I - Causas em geral', 'De R$ 60.000,01 a R$ 70.000,00', '32136', 60000.01, 70000.00, 4393.16, 140),
('TJBA', 'I - Causas em geral', 'De R$ 70.000,01 a R$ 90.000,00', '32140', 70000.01, 90000.00, 5583.30, 150),
('TJBA', 'I - Causas em geral', 'De R$ 90.000,01 a R$ 120.000,00', '32148', 90000.01, 120000.00, 6784.46, 160),
('TJBA', 'I - Causas em geral', 'De R$ 120.000,01 a R$ 160.000,00', '32158', 120000.01, 160000.00, 8296.52, 170),
('TJBA', 'I - Causas em geral', 'De R$ 160.000,01 a R$ 210.000,00', '32162', 160000.01, 210000.00, 9227.06, 180),
('TJBA', 'I - Causas em geral', 'De R$ 210.000,01 a R$ 260.000,00', '32166', 210000.01, 260000.00, 10555.62, 190),
('TJBA', 'I - Causas em geral', 'De R$ 260.000,01 a R$ 350.000,00', '32170', 260000.01, 350000.00, 13558.50, 200),
('TJBA', 'I - Causas em geral', 'De R$ 350.000,01 a R$ 450.000,00', '32180', 350000.01, 450000.00, 16378.34, 210),
('TJBA', 'I - Causas em geral', 'De R$ 450.000,01 a R$ 550.000,00', '32185', 450000.01, 550000.00, 17361.06, 220),
('TJBA', 'I - Causas em geral', 'De R$ 550.000,01 a R$ 650.000,00', '32230', 550000.01, 650000.00, 18402.72, 230),
('TJBA', 'I - Causas em geral', 'A partir de R$ 650.000,01', '32222', 650000.01, NULL, 19506.88, 240);

-- Demais Atos ou Feitos
INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_pagar, nr_ordem) VALUES
('TJBA', 'Demais Atos ou Feitos', 'II - Ação penal', '39012', 421.22, 300),
('TJBA', 'Demais Atos ou Feitos', 'III - Carta precatória, de ordem e rogatória, incluído porte de retorno', '37015', 233.98, 310),
('TJBA', 'Demais Atos ou Feitos', 'IV - Litisconsórcio ativo voluntário, por parte excedente', '49033', 36.68, 320),
('TJBA', 'Demais Atos ou Feitos', 'V - Incidentes processuais e impugnações em geral', '49050', 421.22, 330);

-- Recursos Judiciais — a) Apelação e recurso adesivo
INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_faixa_min, vl_faixa_max, vl_pagar, nr_ordem) VALUES
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'Até R$ 1.500,00', '40100', NULL, 1500.00, 105.52, 400),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 1.500,01 a R$ 2.500,00', '40120', 1500.01, 2500.00, 181.94, 410),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 2.500,01 a R$ 4.000,00', '40130', 2500.01, 4000.00, 283.86, 420),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 4.000,01 a R$ 6.000,00', '40140', 4000.01, 6000.00, 422.16, 430),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 6.000,01 a R$ 8.000,00', '40145', 6000.01, 8000.00, 545.94, 440),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 8.000,01 a R$ 11.000,00', '40150', 8000.01, 11000.00, 655.14, 450),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 11.000,01 a R$ 15.000,00', '40152', 11000.01, 15000.00, 800.74, 460),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 15.000,01 a R$ 19.000,00', '40155', 15000.01, 19000.00, 946.32, 470),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 19.000,01 a R$ 23.000,00', '40160', 19000.01, 23000.00, 1091.94, 480),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 23.000,01 a R$ 28.000,00', '40165', 23000.01, 28000.00, 1237.54, 490),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 28.000,01 a R$ 35.000,00', '40170', 28000.01, 35000.00, 1383.12, 500),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 35.000,01 a R$ 45.000,00', '40175', 35000.01, 45000.00, 1674.30, 510),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 45.000,01 a R$ 60.000,00', '40180', 45000.01, 60000.00, 1892.70, 520),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 60.000,01 a R$ 70.000,00', '40185', 60000.01, 70000.00, 2256.70, 530),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 70.000,01 a R$ 90.000,00', '40190', 70000.01, 90000.00, 2620.68, 540),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 90.000,01 a R$ 120.000,00', '40195', 90000.01, 120000.00, 3130.26, 550),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 120.000,01 a R$ 160.000,00', '41200', 120000.01, 160000.00, 3494.24, 560),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 160.000,01 a R$ 210.000,00', '41210', 160000.01, 210000.00, 3931.04, 570),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 210.000,01 a R$ 260.000,00', '41220', 210000.01, 260000.00, 4166.90, 580),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'De R$ 260.000,01 a R$ 350.000,00', '41230', 260000.01, 350000.00, 4416.92, 590),
('TJBA', 'Recursos Judiciais - Apelação e recurso adesivo', 'A partir de R$ 350.000,01', '41240', 350000.01, NULL, 5722.36, 600);

INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_pagar, nr_ordem) VALUES
('TJBA', 'Recursos Judiciais', 'b) Agravo de Instrumento, Apelação Criminal e outros recursos não previstos nas demais letras deste item', '40035', 421.22, 610),
('TJBA', 'Recursos Judiciais', 'c) Recurso Inominado (Juizados Especiais)', '40013', 616.30, 620);

-- Atos dos Oficiais de Justiça / Avaliadores
INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_pagar, nr_ordem) VALUES
('TJBA', 'Atos dos Oficiais de Justiça / Avaliadores', 'VII - Citação, intimação, notificação e entrega de ofício, por ato praticado e respectiva certificação', '41018', 158.06, 700),
('TJBA', 'Atos dos Oficiais de Justiça / Avaliadores', 'VIII - Arresto, sequestro, despejo, arrolamento, levantamento, busca e apreensão, arrombamento, imissão na posse e outros atos, por mandado', '42015', 238.38, 710),
('TJBA', 'Atos dos Oficiais de Justiça / Avaliadores', 'IX - Auto de penhora (incluída a avaliação), por mandado', '43015', 357.56, 720),
('TJBA', 'Atos dos Oficiais de Justiça / Avaliadores', 'X - Avaliação Judicial, por mandado', '39060', 238.38, 730);

-- Demais Despesas Processuais
INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_pagar, ds_valor_especial, nr_ordem) VALUES
('TJBA', 'Demais Despesas Processuais', 'XI - Desarquivamento de processo, inclusive eletrônico, por processo', '40050', 66.12, NULL, 800),
('TJBA', 'Demais Despesas Processuais', 'XII - Restauração de autos', '39049', 273.04, NULL, 810),
('TJBA', 'Demais Despesas Processuais', 'XIII - Pesquisa e/ou efetivação de restrições nos sistemas eletrônicos (SISBAJUD, RENAJUD, INFOJUD, SERASAJUD), por consulta em cada sistema', '91100', 32.86, NULL, 820),
('TJBA', 'Demais Despesas Processuais', 'XIV - Cópia digital de registros fonográficos e audiovisuais de audiência/sessão, por cópia', '91110', 46.72, NULL, 830),
('TJBA', 'Demais Despesas Processuais', 'XV - Transcrição de declaração registrada na gravação eletrônica de audiência/sessão, por declaração', '91115', 46.72, NULL, 840),
('TJBA', 'Demais Despesas Processuais', 'XVI - Fornecimento de cópia em meio digital de processo eletrônico, com fornecimento da mídia ao TJBA', '91120', 15.56, NULL, 850),
('TJBA', 'Demais Despesas Processuais', 'XVII - Cópia reprográfica ou digital de processo físico, por página', '91125', 6.18, NULL, 860),
('TJBA', 'Demais Despesas Processuais', 'XVIII - Expedição de Alvará, Cartas de Sentença, Arrematação, Adjudicação, Remição e Formal de Partilha', '91130', 47.72, NULL, 870),
('TJBA', 'Demais Despesas Processuais', 'XIX - Citações e intimações por via postal', '91135', 19.84, NULL, 880),
('TJBA', 'Demais Despesas Processuais', 'XX - Publicações de editais no Diário da Justiça', '91140', 48.12, NULL, 890),
('TJBA', 'Demais Despesas Processuais', 'XXI - Porte de remessa e retorno de autos físicos', NULL, NULL, 'Conforme Tarifas Correios', 900),
('TJBA', 'Demais Despesas Processuais', 'XXII - Cálculos Judiciais', '91145', 468.06, NULL, 910),
('TJBA', 'Demais Despesas Processuais', 'XXIII - Audiência de conciliação e sessão de mediação processual ou pedido de homologação de acordo pré-processual (CEJUSC)', '91150', 156.68, NULL, 920),
('TJBA', 'Demais Despesas Processuais', 'XXIV - Registro de cessão de crédito em precatório', '91155', 421.22, NULL, 930);

-- Certidões
INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_pagar, ds_valor_especial, nr_ordem) VALUES
('TJBA', 'Certidões', 'XXV - Certidão Judicial positiva ou negativa', NULL, NULL, 'Gratuita', 1000),
('TJBA', 'Certidões', 'XXVI - Certidão do valor líquido disponível em precatório - CVLD', '47030', 118.78, NULL, 1010),
('TJBA', 'Certidões', 'XXVII - Certidão de objeto e pé, de teor de decisão judicial para fins de protesto, para fins de averbação premonitória, em geral de processo de precatório', '47040', 23.82, NULL, 1020);

-- ----------------------------------------------------------------
-- TABELA II — NOTAS (Tabelionato de Notas)
-- ----------------------------------------------------------------

INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_faixa_min, vl_faixa_max, vl_pagar, nr_ordem) VALUES
('NOTAS', 'I - Atos com Valor Econômico', 'Até R$ 1.600,00', '01020', NULL, 1600.00, 333.34, 10),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 1.600,01 a R$ 3.200,00', '01030', 1600.01, 3200.00, 419.30, 20),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 3.200,01 a R$ 8.000,00', '01040', 3200.01, 8000.00, 505.24, 30),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 8.000,01 a R$ 12.000,00', '01049', 8000.01, 12000.00, 546.06, 40),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 12.000,01 a R$ 16.000,00', '01058', 12000.01, 16000.00, 587.62, 50),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 16.000,01 a R$ 24.000,00', '01066', 16000.01, 24000.00, 670.86, 60),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 24.000,01 a R$ 32.000,00', '01074', 24000.01, 32000.00, 756.26, 70),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 32.000,01 a R$ 47.000,00', '01082', 32000.01, 47000.00, 835.36, 80),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 47.000,01 a R$ 63.000,00', '01086', 47000.01, 63000.00, 920.54, 90),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 63.000,01 a R$ 78.000,00', '01090', 63000.01, 78000.00, 1010.84, 100),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 78.000,01 a R$ 118.000,00', '01097', 78000.01, 118000.00, 1076.62, 110),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 118.000,01 a R$ 160.000,00', '01104', 118000.01, 160000.00, 1164.82, 120),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 160.000,01 a R$ 235.000,00', '01112', 160000.01, 235000.00, 1885.66, 130),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 235.000,01 a R$ 350.000,00', '01120', 235000.01, 350000.00, 2828.84, 140),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 350.000,01 a R$ 530.000,00', '01139', 350000.01, 530000.00, 4248.68, 150),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 530.000,01 a R$ 800.000,00', '01147', 530000.01, 800000.00, 6371.40, 160),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 800.000,01 a R$ 1.200.000,00', '01155', 800000.01, 1200000.00, 9555.60, 170),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 1.200.000,01 a R$ 1.800.000,00', '01163', 1200000.01, 1800000.00, 11466.66, 180),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 1.800.000,01 a R$ 2.700.000,00', '01171', 1800000.01, 2700000.00, 14907.00, 190),
('NOTAS', 'I - Atos com Valor Econômico', 'De R$ 2.700.000,01 a R$ 4.000.000,00', '01180', 2700000.01, 4000000.00, 19379.08, 200),
('NOTAS', 'I - Atos com Valor Econômico', 'A partir de R$ 4.000.000,01', '01198', 4000000.01, NULL, 25192.90, 210);

INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_pagar, ds_valor_especial, nr_ordem) VALUES
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'II - Atos sem valor econômico', '02011', 271.60, NULL, 300),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'III a) Testamento público ou aprovação de Testamento Cerrado', '02020', 940.14, NULL, 310),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'III b) Revogação de Testamento', '02030', 271.60, NULL, 320),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'IV - Escritura de convenção ou instituição de condomínio ou suas modificações', '03019', 626.76, NULL, 330),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'V a) Procuração simples ou substabelecimento', '04014', 118.58, NULL, 340),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'V a.1) Por outorgante a mais', '04022', 47.40, NULL, 350),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'V b) Revogação ou Renúncia', '04033', 118.58, NULL, 360),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'V c) Procuração para fins exclusivos de recebimento de benefícios previdenciários ou assistenciais do INSS', '04050', NULL, 'Isento', 370),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'VI - Certidão, traslado, cópia de documento arquivado, materialização de certidão de cartório diverso', '05011', 118.78, NULL, 380),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'VII - Pesquisa/busca', '05012', 39.58, NULL, 390),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'VIII a) Reconhecimento de firma, letra ou sinal - por semelhança', '06017', 7.20, NULL, 400),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'VIII b) por autenticidade', '06030', 21.60, NULL, 410),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'VIII c) eletrônicas/digitais, inclusive para Autorização Eletrônica de Viagem', '06030', 21.60, NULL, 420),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'IX a) Autenticação de documento em cópia impressa', '06025', 7.20, NULL, 430),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'IX b) autenticação eletrônica (CENAD), por documento', '06030', 21.60, NULL, 440),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'X - Pública Forma, por página', '06106', 84.54, NULL, 450),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XI - Confecção e guarda do cartão de assinatura', '06203', 7.20, NULL, 460),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XII a) Ata notarial - até 5 páginas', '06300', 474.62, NULL, 470),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XII b) por página adicional', '06301', 94.88, NULL, 480),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XIII - Escrituras de divórcio, separação, dissolução de união estável, restabelecimento da sociedade conjugal e inventário, sem partilha de bens', '06401', 333.34, NULL, 490),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XIV - Escrituras de declaração de união estável e homoafetiva; de pacto antenupcial e contrato de namoro', '06412', 333.34, NULL, 500),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XV a) Escritura de divisão ou estremação - pela instrumentalização principal', '06420', 305.68, NULL, 510),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XV b) por cada unidade dividida ou estremada', '06430', 101.86, NULL, 520),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XVI - Apostilamento de Haia', '40000', 118.58, NULL, 530),
('NOTAS', 'Demais Atos dos Tabeliães de Notas', 'XVII - Conciliação e Mediação, por cada hora de sessão', '06440', 313.38, NULL, 540);

-- ----------------------------------------------------------------
-- TABELA III — RI (Registro de Imóveis)
-- ----------------------------------------------------------------

INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_faixa_min, vl_faixa_max, vl_pagar, nr_ordem) VALUES
('RI', 'I - Atos com Valor Econômico', 'Até R$ 1.600,00', '07015', NULL, 1600.00, 333.34, 10),
('RI', 'I - Atos com Valor Econômico', 'De R$ 1.600,01 a R$ 3.200,00', '07035', 1600.01, 3200.00, 419.30, 20),
('RI', 'I - Atos com Valor Econômico', 'De R$ 3.200,01 a R$ 8.000,00', '07048', 3200.01, 8000.00, 505.24, 30),
('RI', 'I - Atos com Valor Econômico', 'De R$ 8.000,01 a R$ 12.000,00', '07052', 8000.01, 12000.00, 546.06, 40),
('RI', 'I - Atos com Valor Econômico', 'De R$ 12.000,01 a R$ 16.000,00', '07056', 12000.01, 16000.00, 587.62, 50),
('RI', 'I - Atos com Valor Econômico', 'De R$ 16.000,01 a R$ 24.000,00', '07064', 16000.01, 24000.00, 670.86, 60),
('RI', 'I - Atos com Valor Econômico', 'De R$ 24.000,01 a R$ 32.000,00', '07072', 24000.01, 32000.00, 756.26, 70),
('RI', 'I - Atos com Valor Econômico', 'De R$ 32.000,01 a R$ 47.000,00', '07080', 32000.01, 47000.00, 835.36, 80),
('RI', 'I - Atos com Valor Econômico', 'De R$ 47.000,01 a R$ 63.000,00', '07089', 47000.01, 63000.00, 920.54, 90),
('RI', 'I - Atos com Valor Econômico', 'De R$ 63.000,01 a R$ 78.000,00', '07099', 63000.01, 78000.00, 1010.84, 100),
('RI', 'I - Atos com Valor Econômico', 'De R$ 78.000,01 a R$ 118.000,00', '07100', 78000.01, 118000.00, 1076.62, 110),
('RI', 'I - Atos com Valor Econômico', 'De R$ 118.000,01 a R$ 160.000,00', '07102', 118000.01, 160000.00, 1164.82, 120),
('RI', 'I - Atos com Valor Econômico', 'De R$ 160.000,01 a R$ 235.000,00', '07110', 160000.01, 235000.00, 1885.66, 130),
('RI', 'I - Atos com Valor Econômico', 'De R$ 235.000,01 a R$ 350.000,00', '07129', 235000.01, 350000.00, 2828.84, 140),
('RI', 'I - Atos com Valor Econômico', 'De R$ 350.000,01 a R$ 530.000,00', '07137', 350000.01, 530000.00, 4248.68, 150),
('RI', 'I - Atos com Valor Econômico', 'De R$ 530.000,01 a R$ 800.000,00', '07145', 530000.01, 800000.00, 6371.40, 160),
('RI', 'I - Atos com Valor Econômico', 'De R$ 800.000,01 a R$ 1.200.000,00', '07153', 800000.01, 1200000.00, 9555.60, 170),
('RI', 'I - Atos com Valor Econômico', 'De R$ 1.200.000,01 a R$ 1.800.000,00', '07161', 1200000.01, 1800000.00, 11466.66, 180),
('RI', 'I - Atos com Valor Econômico', 'De R$ 1.800.000,01 a R$ 2.700.000,00', '07170', 1800000.01, 2700000.00, 14907.00, 190),
('RI', 'I - Atos com Valor Econômico', 'De R$ 2.700.000,01 a R$ 4.000.000,00', '07188', 2700000.01, 4000000.00, 19379.08, 200),
('RI', 'I - Atos com Valor Econômico', 'A partir de R$ 4.000.000,01', '07196', 4000000.01, NULL, 25192.90, 210);

INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_pagar, nr_ordem) VALUES
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'II - Registro sem valor econômico', '08010', 271.60, 300),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'III - Averbação sem valor econômico', '09016', 101.86, 310),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'IV - Registro de loteamento urbano ou rural, por gleba ou lote', '10014', 33.82, 320),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'V a) Desmembramento ou desdobro de imóvel urbano, por cada unidade que resultar', '10020', 101.86, 330),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'V b) de imóvel rural', '10030', 160.12, 340),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'VI - Registro "verbo ad verbum" sem valor econômico, por página', '11010', 101.86, 350),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'VII a) Certidão de cadeia sucessória, por imóvel', '13022', 178.18, 360),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'VII b) Demais certidões ou cópia de documento arquivado', '13042', 118.78, 370),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'VIII - Prenotação ou Exame e Cálculo', '13043', 71.52, 380),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'IX - Pesquisa/busca, sob qualquer forma', '13044', 39.58, 390),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'X - Instituição de Condomínio, por unidade autônoma, inclusive multipropriedade', '13112', 62.36, 400),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XI - Convenção de condomínio - até 5 unidades', '13120', 312.72, 410),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XI - Convenção de condomínio - de 6 a 10 unidades', '13122', 624.08, 420),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XI - Convenção de condomínio - de 11 a 20 unidades', '13124', 936.16, 430),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XI - Convenção de condomínio - de 21 a 50 unidades', '13126', 1248.18, 440),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XI - Convenção de condomínio - de 51 a 100 unidades', '13128', 2496.54, 450),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XI - Convenção de condomínio - acima de 100 unidades', '13130', 4368.94, 460),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XII - Notificação ou Intimação extrajudicial, por pessoa e endereço', '13205', 158.06, 470),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XIII - Abertura de matrícula a requerimento do interessado', '13215', 23.38, 480),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XIV - Averbação de georreferenciamento', '13230', 312.04, 490),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XV - Processo de retificação de áreas', '13234', 312.04, 500),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XVI - Visualização eletrônica de matrícula', '13236', 39.58, 510),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XVII - Abertura de procedimento da usucapião administrativa ou de adjudicação compulsória', '13241', 624.08, 520),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XVIII - Apostilamento de Haia', '13250', 118.58, 530),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XIX - Conciliação e Mediação, por cada hora de sessão', '13260', 313.38, 540),
('RI', 'Demais Atos dos Oficiais de Registro de Imóveis', 'XX - Monitoramento registral de matrícula', '13270', 118.78, 550);

-- ----------------------------------------------------------------
-- TABELA VI — CRPN (Registro Civil das Pessoas Naturais)
-- ----------------------------------------------------------------

INSERT INTO soma.tabela_custas (tp_tabela, nm_secao, ds_ato, cd_ato, vl_pagar, ds_valor_especial, nr_ordem) VALUES
('CRPN', 'Atos dos Oficiais de Registro Civil', 'I - Habilitação de casamento e de conversão da união estável em casamento, incluindo preparo de papéis, lavratura do assento de proclamas e certidão da habilitação', '25011', 271.14, NULL, 10),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'II - Assento de casamento, a vista de certidão de habilitação de outro cartório', '26042', 203.44, NULL, 20),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'III - Registro de casamento', '27015', 101.86, NULL, 30),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'IV - Registro da emancipação, interdição, ausência, aquisição definitiva de nacionalidade brasileira, união estável no livro "E"', '27025', 101.86, NULL, 40),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'V - Transcrição de registros de nascimento, casamento ou óbito ocorridos no estrangeiro; averbação de sentença ou escritura pública estrangeiras de divórcio', '27040', 164.30, NULL, 50),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'VI - Averbação de assento, por requerimento ou mandado judicial', '28015', 101.86, NULL, 60),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'VII - Publicação de editais de proclamas de outro cartório, incluída a fixação, o registro e o fornecimento da certidão', '29017', 101.86, NULL, 70),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'VIII - Certidão em geral ou cópia de documento arquivado sob qualquer forma', '30020', 43.86, NULL, 80),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'IX - Certidão em geral, com busca', '30023', 67.24, NULL, 90),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'X - Certidão de inteiro teor', '30031', 118.78, NULL, 100),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XI - Pesquisa/busca', '30040', 23.38, NULL, 110),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XII - Registro de nascimento ou óbito, incluída a 1ª certidão', NULL, NULL, 'Gratuito', 120),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XIII - Processo de retificação extrajudicial', '31005', 271.14, NULL, 130),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XIV - Apostilamento de Haia', '31030', 118.58, NULL, 140),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XV - Conciliação e Mediação, por cada hora de sessão', '31035', 313.38, NULL, 150),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XVI - Termo declaratório de reconhecimento ou de dissolução da união estável', '31038', 135.56, NULL, 160),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XVII - Procedimento de certificação eletrônica da união estável', '31040', 271.14, NULL, 170),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XVIII - Processamento do requerimento de alteração de regime de bens, decorrente do registro da união estável', '31045', 271.14, NULL, 180),
('CRPN', 'Atos dos Oficiais de Registro Civil', 'XIX - Ressarcimento de despesas pelo conjunto de comunicações exigidas por Lei, Decreto, Resolução e demais Normas Infralegais', NULL, 62.68, NULL, 190);
