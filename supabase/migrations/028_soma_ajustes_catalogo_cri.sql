-- ================================================================
-- SOMA — Migration 028
-- Ajustes no catálogo CRI encontrados ao cruzar com a planilha
-- "TAXAS E EMOLUMENTOS":
--
-- 1) Serviço que faltava: CRI > Averbação > "Complementar" (mesmo
--    código/preço das demais averbações sem valor econômico) — e o
--    pacote automático (Prenotação 13043 + Averbação 09016 +
--    Certidão de Ônus 13042 opcional) igual aos outros 13 serviços
--    de Averbação já configurados na migration 022.
--
-- 2) "Construção/Ampliação" (Averbação) estava com código fixo 09016
--    (101,86), mas a planilha marca como "por faixa valor" — igual o
--    serviço irmão "Construção/Ampliação (por faixa)" que já estava
--    certo. Corrigido pra valor variável (sem código/preço fixo).
--
-- 3) "Convenção de condomínio sem valor declarado" (Registro) estava
--    com código fixo 08010 (271,60), mas a planilha usa uma tabela
--    por número de unidades (13120 até 5 / 13122 6-10 / 13124 11-20 /
--    13126 21-50 / 13128 51-100 / 13130 acima de 100) — faixa por
--    QUANTIDADE, não por valor, então o mecanismo de "faixa" dos
--    Pacotes (que resolve por valor) não serve aqui. Corrigido pra
--    valor variável — o operador escolhe o boleto certo manualmente
--    em Taxas e Emolumentos até o sistema ganhar um campo de
--    "número de unidades" pra automatizar isso também.
-- ================================================================

-- 1a) Novo serviço "Complementar"
INSERT INTO soma.servicos (tp_local, nm_categoria, nm_servico, cd_codigo, tp_servico, sn_valor_variavel, sn_ativo)
SELECT 'CRI', 'Averbação', 'Complementar', '09016', tp_servico, false, true
FROM soma.servicos
WHERE tp_local = 'CRI' AND nm_categoria = 'Averbação' AND nm_servico = 'Alteração de endereço do imóvel'
LIMIT 1;

-- 1b) Honorários SOMA por cidade — mesmo valor das demais averbações
INSERT INTO soma.servico_precos (cd_servico, nm_cidade, vl_valor)
SELECT s.cd_servico, c.nm_cidade, c.vl_valor
FROM soma.servicos s
CROSS JOIN (VALUES ('Salvador', 700), ('Lauro de Freitas', 900), ('Camaçari', 1100)) AS c(nm_cidade, vl_valor)
WHERE s.tp_local = 'CRI' AND s.nm_categoria = 'Averbação' AND s.nm_servico = 'Complementar';

-- 1c) Pacote automático — mesmo padrão "FLUXO SIMPLES" dos outros 13
-- serviços de Averbação (migration 022).
INSERT INTO soma.pacote_itens (cd_servico, cd_custa, sn_opcional)
SELECT s.cd_servico, c.cd_custa, p.sn_opcional
FROM soma.servicos s
JOIN (VALUES ('13043', false), ('09016', false), ('13042', true)) AS p(cd_ato, sn_opcional) ON true
JOIN soma.tabela_custas c ON c.tp_tabela = 'RI' AND c.cd_ato = p.cd_ato
WHERE s.tp_local = 'CRI' AND s.nm_categoria = 'Averbação' AND s.nm_servico = 'Complementar'
ON CONFLICT (cd_servico, cd_custa) DO NOTHING;

-- 2) "Construção/Ampliação" — corrige pra valor variável
UPDATE soma.servicos
SET cd_codigo = NULL, sn_valor_variavel = true
WHERE tp_local = 'CRI' AND nm_categoria = 'Averbação' AND nm_servico = 'Construção/Ampliação';

DELETE FROM soma.servico_precos
WHERE cd_servico = (
  SELECT cd_servico FROM soma.servicos
  WHERE tp_local = 'CRI' AND nm_categoria = 'Averbação' AND nm_servico = 'Construção/Ampliação'
);

-- 3) "Convenção de condomínio sem valor declarado" — corrige pra
-- valor variável (faixa por unidades, escolha manual do boleto)
UPDATE soma.servicos
SET cd_codigo = NULL, sn_valor_variavel = true
WHERE tp_local = 'CRI' AND nm_categoria = 'Registro' AND nm_servico = 'Convenção de condomínio sem valor declarado';

DELETE FROM soma.servico_precos
WHERE cd_servico = (
  SELECT cd_servico FROM soma.servicos
  WHERE tp_local = 'CRI' AND nm_categoria = 'Registro' AND nm_servico = 'Convenção de condomínio sem valor declarado'
);
