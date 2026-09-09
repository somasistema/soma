-- ================================================================
-- SOMA — Migration 053
-- Chat do processo: um mural de mensagens por processo, visível a
-- todo mundo que já enxerga o processo (as 5 frentes, despachante,
-- jurídico...). Escrita direta com policy de INSERT (mesmo esquema de
-- soma.documentos), não por função. Realtime ligado pra atualizar sem
-- recarregar.
-- ================================================================

CREATE TABLE soma.mensagens_processo (
  cd_mensagem UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  cd_autor UUID NOT NULL REFERENCES soma.usuarios(cd_usuario),
  -- Nome congelado no envio: soma.usuarios só deixa cada um ler a
  -- própria linha (ver migration 040), então não dá pra fazer o join
  -- pra mostrar quem escreveu.
  nm_autor VARCHAR(255) NOT NULL,
  ds_texto TEXT NOT NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_mensagens_processo_processo
  ON soma.mensagens_processo(cd_processo, ts_criacao);

ALTER TABLE soma.mensagens_processo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mensagens_processo_select" ON soma.mensagens_processo FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));

CREATE POLICY "mensagens_processo_insert" ON soma.mensagens_processo FOR INSERT
  WITH CHECK (
    cd_autor = auth.uid()
    AND soma.fn_pode_ver_processo(cd_processo)
    AND length(trim(ds_texto)) > 0
  );

-- Realtime (postgres_changes). Ignora se a tabela já estiver na
-- publicação.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE soma.mensagens_processo;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
