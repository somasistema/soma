-- ================================================================
-- SOMA — Migration 030
-- /esqueci-senha é pública (sem login) — sem isso, dava pra ficar
-- reenviando o link de recuperação pro mesmo e-mail sem limite
-- (spam na caixa de entrada da pessoa, gasto no Resend). Guarda a
-- última tentativa por usuário e a action passa a ignorar pedidos
-- repetidos antes de 2 minutos, sem mudar a resposta que a pessoa vê
-- (continua sempre a mesma mensagem de sucesso).
-- ================================================================

ALTER TABLE soma.usuarios
  ADD COLUMN ts_ultima_recuperacao_senha TIMESTAMPTZ;
