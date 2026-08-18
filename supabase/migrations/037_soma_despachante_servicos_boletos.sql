-- ================================================================
-- SOMA — Migration 037
-- Despachante passa a enxergar as seções "Serviços" e "Taxas e
-- Emolumentos" no menu (sn_ver) — só visualização, sem alterar
-- criar/editar/excluir (continuam false, igual já estava).
-- ================================================================

UPDATE soma.perfil_acesso
SET sn_ver = true
WHERE cd_secao IN ('servicos', 'boletos') AND tp_role = 'despachante';
