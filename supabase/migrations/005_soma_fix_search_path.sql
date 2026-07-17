-- ================================================================
-- SOMA — Migration 005
-- Corrige o advisor "function_search_path_mutable" nas duas funções
-- de trigger que vieram sem SET search_path fixo.
-- ================================================================
CREATE OR REPLACE FUNCTION soma.fn_atualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = soma, public AS $$
BEGIN
    NEW.ts_atualizacao = NOW();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION soma.fn_gerar_numero_processo()
RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = soma, public AS $$
BEGIN
  NEW.ds_numero_processo := 'SOMA-' || extract(year from now())::text || '-' ||
    lpad(nextval('soma.seq_numero_processo')::text, 4, '0');
  RETURN NEW;
END;
$$;
