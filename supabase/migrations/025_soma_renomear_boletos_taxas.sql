-- ================================================================
-- SOMA — Migration 025
-- Renomeia o bloco "Boletos (Custas)" do Fluxo pra "Taxas e
-- Emolumentos" — o termo "boleto" era só o meio de pagamento, o nome
-- certo do que está sendo cobrado (Prenotação, Certidão, ITIV etc) é
-- taxa/emolumento de cartório e órgão público.
-- ================================================================

UPDATE soma.fluxo_blocos
SET nm_bloco = 'Taxas e Emolumentos'
WHERE cd_bloco = 'boletos';
