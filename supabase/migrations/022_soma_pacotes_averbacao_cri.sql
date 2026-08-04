-- ================================================================
-- SOMA — Migration 022
-- Popula soma.pacote_itens pros serviços de Averbação (CRI) marcados
-- na planilha como "FLUXO SIMPLES" — pacote padrão: Prenotação
-- (13043) + o próprio ato de Averbação (09016), com Certidão de
-- Ônus (13042) entrando como opcional.
--
-- OBS: 2 linhas da planilha ficaram de fora por serem ambíguas —
-- "Construção/Ampliação (por faixa)" (código 070XX, sem CÓDIGOS
-- preenchido) e "Retificação de área" (códigos cortados na imagem,
-- parecia usar 13241 em vez de 13043) — perguntar antes de incluir.
--
-- Idempotente: pode rodar de novo sem duplicar (UNIQUE cd_servico +
-- cd_custa na migration 021, ON CONFLICT DO NOTHING aqui).
-- ================================================================

WITH servicos_alvo (nm_servico) AS (
  VALUES
    ('Alteração de endereço do imóvel'),
    ('Alteração de inscrição municipal'),
    ('Divórcio (estado civil)'),
    ('Pacto antenupcial'),
    ('Cancelamento de indisponibilidade'),
    ('Cancelamento de usufruto'),
    ('Cancelamento de cláusula resolutiva'),
    ('Cancelamento de caução'),
    ('Cancelamento de alienação fiduciária (baixa de hipoteca)'),
    ('Vinculação de vaga de garagem'),
    ('Carta de sentença'),
    ('Construção/Ampliação'),
    ('Georreferenciamento')
),
codigos_pacote (cd_ato, sn_opcional) AS (
  VALUES
    ('13043', false),
    ('09016', false),
    ('13042', true)
)
INSERT INTO soma.pacote_itens (cd_servico, cd_custa, sn_opcional)
SELECT s.cd_servico, c.cd_custa, p.sn_opcional
FROM servicos_alvo t
JOIN soma.servicos s
  ON s.tp_local = 'CRI'
  AND s.nm_categoria = 'Averbação'
  AND s.nm_servico = t.nm_servico
JOIN codigos_pacote p ON true
JOIN soma.tabela_custas c
  ON c.tp_tabela = 'RI'
  AND c.cd_ato = p.cd_ato
ON CONFLICT (cd_servico, cd_custa) DO NOTHING;

-- Conferência pós-execução: rode isso pra ver se algum nome de
-- serviço da lista acima não bateu com soma.servicos (nome escrito
-- diferente, categoria diferente, etc) — se aparecer alguma linha
-- aqui, o pacote daquele serviço não foi criado.
--
-- SELECT t.nm_servico
-- FROM (VALUES
--   ('Alteração de endereço do imóvel'), ('Alteração de inscrição municipal'),
--   ('Divórcio (estado civil)'), ('Pacto antenupcial'),
--   ('Cancelamento de indisponibilidade'), ('Cancelamento de usufruto'),
--   ('Cancelamento de cláusula resolutiva'), ('Cancelamento de caução'),
--   ('Cancelamento de alienação fiduciária (baixa de hipoteca)'),
--   ('Vinculação de vaga de garagem'), ('Carta de sentença'),
--   ('Construção/Ampliação'), ('Georreferenciamento')
-- ) AS t(nm_servico)
-- LEFT JOIN soma.servicos s
--   ON s.tp_local = 'CRI' AND s.nm_categoria = 'Averbação' AND s.nm_servico = t.nm_servico
-- WHERE s.cd_servico IS NULL;
