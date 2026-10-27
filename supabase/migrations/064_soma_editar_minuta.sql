-- ================================================================
-- SOMA — Migration 064
-- Edição da minuta dentro do app.
--
-- Editar o texto cria uma NOVA versão da minuta (a anterior fica no
-- histórico) e reinicia as 5 aprovações — quem aprovou leu o texto
-- antigo. Só Master/Jurídico, e só enquanto não existe contrato final
-- (depois da 5ª aprovação o texto já foi pra assinatura).
-- As marcas de "valor vindo do processo" (STX/ETX, em vermelho na
-- tela) seguem no texto; se a edição desbalancear as marcas, elas
-- são removidas por inteiro pra não pintar a minuta toda de vermelho.
-- ================================================================

ALTER TABLE soma.minutas ADD COLUMN IF NOT EXISTS ds_conteudo_json JSONB;

CREATE OR REPLACE FUNCTION soma.fn_editar_minuta(
  p_cd_minuta UUID,
  p_ds_conteudo TEXT,
  p_ds_json JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_minuta soma.minutas%ROWTYPE;
  v_ultima INTEGER;
  v_texto TEXT;
  v_stx INTEGER;
  v_etx INTEGER;
  v_novo UUID;
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico pode editar a minuta.';
  END IF;

  SELECT * INTO v_minuta FROM soma.minutas WHERE cd_minuta = p_cd_minuta;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Minuta não encontrada.';
  END IF;

  IF v_minuta.ds_conteudo IS NULL THEN
    RAISE EXCEPTION 'Esta minuta é um arquivo enviado; só minuta gerada de modelo é editada aqui.';
  END IF;

  SELECT MAX(nr_versao) INTO v_ultima FROM soma.minutas WHERE cd_processo = v_minuta.cd_processo;
  IF v_minuta.nr_versao <> v_ultima THEN
    RAISE EXCEPTION 'Só a versão mais recente da minuta pode ser editada.';
  END IF;

  IF EXISTS (SELECT 1 FROM soma.contratos WHERE cd_minuta = p_cd_minuta) THEN
    RAISE EXCEPTION 'A minuta já virou contrato final e não pode mais ser editada.';
  END IF;

  v_texto := replace(COALESCE(p_ds_conteudo, ''), E'\r\n', E'\n');
  IF length(trim(v_texto)) < 20 THEN
    RAISE EXCEPTION 'O texto da minuta está vazio.';
  END IF;

  IF v_texto IS NOT DISTINCT FROM v_minuta.ds_conteudo
     AND p_ds_json IS NOT DISTINCT FROM v_minuta.ds_conteudo_json THEN
    RAISE EXCEPTION 'Nenhuma alteração no texto da minuta.';
  END IF;

  v_stx := length(v_texto) - length(replace(v_texto, chr(2), ''));
  v_etx := length(v_texto) - length(replace(v_texto, chr(3), ''));
  IF v_stx <> v_etx THEN
    v_texto := replace(replace(v_texto, chr(2), ''), chr(3), '');
  END IF;

  v_novo := soma.fn_registrar_minuta(v_minuta.cd_processo, v_minuta.ds_storage_url, v_texto);

  -- Documento do editor (formatação). O texto puro acima é derivado dele
  -- pelo app, então as marcas de cor já vêm balanceadas.
  IF p_ds_json IS NOT NULL THEN
    UPDATE soma.minutas SET ds_conteudo_json = p_ds_json WHERE cd_minuta = v_novo;
  END IF;

  RETURN v_novo;
END;
$$;

REVOKE ALL ON FUNCTION soma.fn_editar_minuta(UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION soma.fn_editar_minuta(UUID, TEXT, JSONB) TO authenticated;
