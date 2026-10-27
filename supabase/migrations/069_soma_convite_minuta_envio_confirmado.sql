-- ================================================================
-- SOMA — Migration 069
-- minuta_convites.ts_envio passa a significar "o e-mail realmente saiu":
-- fica vazio até o envio dar certo (antes era preenchido na criação do
-- convite, então um e-mail que falhou aparecia como enviado, e o reenvio
-- repetia o e-mail pra quem já tinha recebido).
-- ================================================================

ALTER TABLE soma.minuta_convites ALTER COLUMN ts_envio DROP NOT NULL;
ALTER TABLE soma.minuta_convites ALTER COLUMN ts_envio DROP DEFAULT;
