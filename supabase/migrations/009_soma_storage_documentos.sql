-- ================================================================
-- SOMA — Migration 009
-- Bucket de Storage para a gestão documental (upload de documentos
-- do Comprador, Vendedor, Imóvel etc. vinculados a um processo).
-- Ao contrário do bucket de PDF de orçamento, este é PRIVADO — os
-- documentos podem conter dados sensíveis (RG, comprovantes) e só
-- devem ser lidos por quem já enxergaria a linha correspondente em
-- soma.documentos.
--
-- Convenção de path: os arquivos são salvos como
-- "{cd_processo}/{uuid-do-documento}-{nome-original}", então dá pra
-- derivar o processo direto do nome do objeto (split_part) sem
-- precisar de tabela auxiliar — mesma ideia de soma.fn_pode_ver_processo,
-- só que aplicada ao path.
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION soma.fn_cd_processo_do_path(p_name TEXT)
RETURNS UUID
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(split_part(p_name, '/', 1), '')::UUID;
$$;

-- Mesmo predicado de soma.documentos_select: quem enviou, Master/Jurídico,
-- ou o Despachante do processo.
CREATE POLICY "documentos_bucket_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documentos'
    AND (
      soma.fn_auth_role() IN ('master', 'juridico')
      OR soma.fn_pode_ver_processo(soma.fn_cd_processo_do_path(name))
    )
  );

-- Mesmo predicado de soma.documentos_insert: qualquer envolvido no processo.
CREATE POLICY "documentos_bucket_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documentos'
    AND soma.fn_pode_ver_processo(soma.fn_cd_processo_do_path(name))
  );

-- Mesmo predicado de soma.documentos_update: Master/Jurídico ou Despachante
-- do processo (quem tem poder de validar também pode remover/substituir).
CREATE POLICY "documentos_bucket_update" ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'documentos'
    AND (
      soma.fn_auth_role() IN ('master', 'juridico')
      OR EXISTS (
        SELECT 1 FROM soma.processos p
        WHERE p.cd_processo = soma.fn_cd_processo_do_path(name)
        AND p.cd_despachante = auth.uid()
      )
    )
  );

CREATE POLICY "documentos_bucket_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documentos'
    AND (
      soma.fn_auth_role() IN ('master', 'juridico')
      OR EXISTS (
        SELECT 1 FROM soma.processos p
        WHERE p.cd_processo = soma.fn_cd_processo_do_path(name)
        AND p.cd_despachante = auth.uid()
      )
    )
  );
