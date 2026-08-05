-- ================================================================
-- SOMA — Migration 027
-- Tela Configurações > Perfil de acesso: até aqui, quais seções do
-- menu cada perfil (role) enxerga era fixo no código
-- (src/app/(dashboard)/layout.tsx e um `if (tp_role !== 'master')
-- redirect(...)` repetido em Serviços/Boletos/Usuários/Configurações).
-- Agora é uma matriz configurável — Master liga/desliga por perfil.
--
-- Master NUNCA aparece na matriz nem pode ser desativado (hardcoded
-- no app) — evita a pessoa se trancar pra fora da própria tela que
-- corrigiria isso.
-- ================================================================

CREATE TABLE soma.perfil_acesso (
  tp_role VARCHAR(20) NOT NULL,
  cd_secao VARCHAR(20) NOT NULL,
  sn_ativo BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (tp_role, cd_secao)
);

ALTER TABLE soma.perfil_acesso ENABLE ROW LEVEL SECURITY;

-- Leitura livre (todo usuário logado precisa saber o que o próprio
-- perfil pode acessar pra montar o menu), escrita só Master.
CREATE POLICY "perfil_acesso_select" ON soma.perfil_acesso FOR SELECT
  USING (true);

CREATE POLICY "perfil_acesso_update" ON soma.perfil_acesso FOR UPDATE
  USING (soma.fn_auth_role() = 'master');

-- Seed com o comportamento que já existia hardcoded: Início e
-- Processos abertos pra todo perfil (RLS de soma.processos já
-- restringe às linhas que cada um pode ver); Orçamentos pra
-- Master/Jurídico; o resto só Master.
INSERT INTO soma.perfil_acesso (tp_role, cd_secao, sn_ativo)
SELECT r.tp_role, s.cd_secao,
  CASE
    WHEN s.cd_secao IN ('dashboard', 'processos') THEN true
    WHEN s.cd_secao = 'orcamentos' THEN r.tp_role IN ('master', 'juridico')
    ELSE r.tp_role = 'master'
  END
FROM (VALUES
  ('master'), ('juridico'), ('imobiliaria'), ('despachante'),
  ('corretor'), ('vendedor'), ('comprador'), ('outro_cliente')
) AS r(tp_role)
CROSS JOIN (VALUES
  ('dashboard'), ('orcamentos'), ('processos'), ('servicos'),
  ('boletos'), ('usuarios'), ('configuracoes')
) AS s(cd_secao);
