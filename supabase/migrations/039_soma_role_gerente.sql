-- ================================================================
-- SOMA — Migration 039
-- Novo perfil "Gerente" (Fase 2 — visão executiva com KPIs). Só o
-- valor do enum aqui, sozinho: ALTER TYPE ... ADD VALUE não pode ser
-- usado na mesma transação em que o valor novo é referenciado, então
-- o resto (perfil_acesso, RLS, fn_criar_orcamento) vai na migration
-- 040, rodada depois desta.
-- ================================================================

ALTER TYPE soma.type_user_role ADD VALUE 'gerente';
