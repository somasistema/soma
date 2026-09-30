-- ================================================================
-- SOMA — Migration 055
-- Documento anexado pela própria parte no link de autoatendimento
-- (fn_registrar_documento_parte, migration 051) não tem um
-- soma.usuarios por trás — quem envia é o vendedor/comprador/corretor
-- externo, sem login, não alguém do sistema. cd_enviado_por precisa
-- aceitar NULL nesse caso (a migration 001 já declarava a coluna
-- nullable; em produção ela ficou NOT NULL por algum motivo anterior
-- às migrations, travando esse upload).
-- ================================================================

ALTER TABLE soma.documentos ALTER COLUMN cd_enviado_por DROP NOT NULL;
