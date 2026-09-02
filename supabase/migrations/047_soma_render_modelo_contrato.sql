-- ================================================================
-- SOMA — Migration 047
-- Extrai a substituição dos {{campos}} do modelo (que morava dentro
-- de fn_gerar_minuta_de_modelo) numa função própria,
-- fn_render_modelo_contrato, que só devolve o texto pronto — sem
-- inserir nada. Serve pra pré-visualizar a minuta antes de gerar.
-- fn_gerar_minuta_de_modelo passa a só delegar.
-- ================================================================

CREATE OR REPLACE FUNCTION soma.fn_render_modelo_contrato(
  p_cd_processo UUID,
  p_cd_modelo UUID
)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_processo soma.processos%ROWTYPE;
  v_conteudo TEXT;
  v_comprador TEXT;
  v_vendedor TEXT;
  v_corretor TEXT;
  v_imobiliaria TEXT;
  v_mes TEXT;
  v_data_extenso TEXT;
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico pode gerar minuta.';
  END IF;

  SELECT * INTO v_processo FROM soma.processos WHERE cd_processo = p_cd_processo;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;
  IF v_processo.tp_processo <> 'contrato' THEN
    RAISE EXCEPTION 'Só processos de contrato geram minuta a partir de modelo.';
  END IF;

  SELECT ds_conteudo INTO v_conteudo
  FROM soma.modelos_contrato WHERE cd_modelo = p_cd_modelo AND sn_ativo;
  IF v_conteudo IS NULL THEN
    RAISE EXCEPTION 'Modelo não encontrado ou inativo.';
  END IF;

  SELECT nm_usuario INTO v_comprador FROM soma.usuarios WHERE cd_usuario = v_processo.cd_comprador;
  v_comprador := COALESCE(v_comprador, v_processo.nm_comprador_convidado, '__________');

  SELECT nm_usuario INTO v_vendedor FROM soma.usuarios WHERE cd_usuario = v_processo.cd_vendedor;
  v_vendedor := COALESCE(v_vendedor, '__________');

  SELECT nm_usuario INTO v_corretor FROM soma.usuarios WHERE cd_usuario = v_processo.cd_corretor;
  v_corretor := COALESCE(v_corretor, '__________');

  SELECT nm_imobiliaria INTO v_imobiliaria
  FROM soma.imobiliarias WHERE cd_imobiliaria = v_processo.cd_imobiliaria;
  v_imobiliaria := COALESCE(v_imobiliaria, '__________');

  v_mes := CASE extract(month FROM current_date)::int
    WHEN 1 THEN 'janeiro'   WHEN 2 THEN 'fevereiro' WHEN 3 THEN 'março'
    WHEN 4 THEN 'abril'     WHEN 5 THEN 'maio'      WHEN 6 THEN 'junho'
    WHEN 7 THEN 'julho'     WHEN 8 THEN 'agosto'    WHEN 9 THEN 'setembro'
    WHEN 10 THEN 'outubro'  WHEN 11 THEN 'novembro' WHEN 12 THEN 'dezembro'
  END;
  v_data_extenso := extract(day FROM current_date)::int || ' de ' || v_mes
    || ' de ' || extract(year FROM current_date)::int;

  v_conteudo := replace(v_conteudo, '{{numero_processo}}', v_processo.ds_numero_processo);
  v_conteudo := replace(v_conteudo, '{{comprador}}', v_comprador);
  v_conteudo := replace(v_conteudo, '{{vendedor}}', v_vendedor);
  v_conteudo := replace(v_conteudo, '{{corretor}}', v_corretor);
  v_conteudo := replace(v_conteudo, '{{imobiliaria}}', v_imobiliaria);
  v_conteudo := replace(v_conteudo, '{{data_hoje}}', to_char(current_date, 'DD/MM/YYYY'));
  v_conteudo := replace(v_conteudo, '{{data_extenso}}', v_data_extenso);

  RETURN v_conteudo;
END;
$$;

CREATE OR REPLACE FUNCTION soma.fn_gerar_minuta_de_modelo(
  p_cd_processo UUID,
  p_cd_modelo UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  RETURN soma.fn_registrar_minuta(
    p_cd_processo,
    NULL,
    soma.fn_render_modelo_contrato(p_cd_processo, p_cd_modelo)
  );
END;
$$;
