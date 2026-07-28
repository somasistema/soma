-- ================================================================
-- SOMA — Migration 013
-- O Log de andamentos deixa de ser preenchido manualmente pelo
-- Despachante e passa a ser gerado automaticamente por triggers a
-- cada movimento real do processo: criação do processo/orçamento,
-- mudança de status do orçamento (aceito/pago/liberado/reprovado),
-- pagamento registrado, documento enviado/validado/rejeitado e
-- pendência criada/concluída.
--
-- cd_despachante deixa de ser NOT NULL: eventos automáticos gravam o
-- despachante responsável pelo processo quando existir um definido,
-- e NULL quando ainda não há despachante atribuído (a UI mostra
-- "Sistema" nesse caso). Os triggers são SECURITY DEFINER, mesmo
-- padrão das demais funções deste schema — bypassam a RLS de
-- soma.andamentos de propósito, já que o autor do movimento (ex:
-- comprador aceitando via token público, webhook do Mercado Pago)
-- muitas vezes não é o despachante nem teria permissão de escrita
-- direta na tabela.
-- ================================================================

ALTER TABLE soma.andamentos ALTER COLUMN cd_despachante DROP NOT NULL;

-- ----------------------------------------------------------------
-- Helper — resolve o despachante do processo e grava a linha.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_registrar_andamento(
  p_cd_processo UUID,
  p_nm_etapa VARCHAR,
  p_ds_andamento TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_despachante UUID;
BEGIN
  SELECT cd_despachante INTO v_cd_despachante
  FROM soma.processos WHERE cd_processo = p_cd_processo;

  INSERT INTO soma.andamentos (cd_processo, cd_despachante, nm_etapa, ds_andamento)
  VALUES (p_cd_processo, v_cd_despachante, p_nm_etapa, p_ds_andamento);
END;
$$;

-- ----------------------------------------------------------------
-- Processo criado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_andamento_processo_criado()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  PERFORM soma.fn_registrar_andamento(
    NEW.cd_processo,
    'Processo criado',
    'Processo ' || NEW.ds_numero_processo || ' criado.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_andamento_processo_criado
AFTER INSERT ON soma.processos
FOR EACH ROW EXECUTE PROCEDURE soma.fn_andamento_processo_criado();

-- ----------------------------------------------------------------
-- Orçamento criado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_andamento_orcamento_criado()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  PERFORM soma.fn_registrar_andamento(
    NEW.cd_processo,
    'Orçamento criado',
    'Orçamento gerado no valor de R$ ' || to_char(NEW.vl_total_geral, 'FM999999990.00') ||
      ', válido até ' || to_char(NEW.dt_validade, 'DD/MM/YYYY') || '.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_andamento_orcamento_criado
AFTER INSERT ON soma.orcamentos
FOR EACH ROW EXECUTE PROCEDURE soma.fn_andamento_orcamento_criado();

-- ----------------------------------------------------------------
-- Orçamento — mudança de status (aceito/pago/liberado/reprovado)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_andamento_orcamento_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_etapa VARCHAR(150);
  v_descricao TEXT;
BEGIN
  IF NEW.tp_status = OLD.tp_status THEN
    RETURN NEW;
  END IF;

  CASE NEW.tp_status
    WHEN 'aceito' THEN
      v_etapa := 'Orçamento aceito';
      v_descricao := 'Comprador aceitou o orçamento no valor de R$ ' ||
        to_char(COALESCE(NEW.vl_total_aceito, NEW.vl_total_geral), 'FM999999990.00') || '.';
    WHEN 'pago' THEN
      v_etapa := 'Pagamento confirmado';
      v_descricao := 'Pagamento do orçamento confirmado.';
    WHEN 'liberado' THEN
      v_etapa := 'Orçamento liberado';
      v_descricao := 'Orçamento liberado pela imobiliária.';
    WHEN 'reprovado' THEN
      v_etapa := 'Orçamento reprovado';
      v_descricao := 'Orçamento marcado como reprovado.';
    ELSE
      v_etapa := 'Status do orçamento atualizado';
      v_descricao := 'Status alterado para ' || NEW.tp_status || '.';
  END CASE;

  PERFORM soma.fn_registrar_andamento(NEW.cd_processo, v_etapa, v_descricao);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_andamento_orcamento_status
AFTER UPDATE ON soma.orcamentos
FOR EACH ROW EXECUTE PROCEDURE soma.fn_andamento_orcamento_status();

-- ----------------------------------------------------------------
-- Pagamento registrado (Pix ou cartão, via webhook do Mercado Pago)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_andamento_pagamento()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
  v_metodo TEXT;
BEGIN
  SELECT cd_processo INTO v_cd_processo
  FROM soma.orcamentos WHERE cd_orcamento = NEW.cd_orcamento;

  IF v_cd_processo IS NULL THEN
    RETURN NEW;
  END IF;

  v_metodo := CASE NEW.tp_metodo WHEN 'pix' THEN 'Pix' ELSE 'cartão' END;

  PERFORM soma.fn_registrar_andamento(
    v_cd_processo,
    'Pagamento registrado',
    'Pagamento via ' || v_metodo || ' no valor de R$ ' || to_char(NEW.vl_pagamento, 'FM999999990.00') ||
      ' — status: ' || NEW.tp_status || '.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_andamento_pagamento
AFTER INSERT ON soma.pagamentos
FOR EACH ROW EXECUTE PROCEDURE soma.fn_andamento_pagamento();

-- ----------------------------------------------------------------
-- Documento enviado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_andamento_documento_enviado()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  PERFORM soma.fn_registrar_andamento(
    NEW.cd_processo,
    'Documento enviado',
    'Documento "' || NEW.nm_tipo_documento || '" enviado.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_andamento_documento_enviado
AFTER INSERT ON soma.documentos
FOR EACH ROW EXECUTE PROCEDURE soma.fn_andamento_documento_enviado();

-- ----------------------------------------------------------------
-- Documento validado / rejeitado
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_andamento_documento_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  IF NEW.tp_status = OLD.tp_status OR NEW.tp_status = 'pendente' THEN
    RETURN NEW;
  END IF;

  PERFORM soma.fn_registrar_andamento(
    NEW.cd_processo,
    CASE NEW.tp_status WHEN 'validado' THEN 'Documento validado' ELSE 'Documento rejeitado' END,
    'Documento "' || NEW.nm_tipo_documento || '" ' ||
      CASE NEW.tp_status WHEN 'validado' THEN 'validado' ELSE 'rejeitado' END ||
      COALESCE('. Observação: ' || NEW.ds_observacoes, '') || '.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_andamento_documento_status
AFTER UPDATE ON soma.documentos
FOR EACH ROW EXECUTE PROCEDURE soma.fn_andamento_documento_status();

-- ----------------------------------------------------------------
-- Pendência registrada
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_andamento_pendencia_criada()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  PERFORM soma.fn_registrar_andamento(
    NEW.cd_processo,
    'Pendência registrada',
    NEW.ds_pendencia ||
      CASE WHEN NEW.dt_prazo IS NOT NULL THEN ' (prazo: ' || to_char(NEW.dt_prazo, 'DD/MM/YYYY') || ')' ELSE '' END ||
      '.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_andamento_pendencia_criada
AFTER INSERT ON soma.pendencias
FOR EACH ROW EXECUTE PROCEDURE soma.fn_andamento_pendencia_criada();

-- ----------------------------------------------------------------
-- Pendência concluída / reaberta — também carimba ts_conclusao
-- automaticamente (antes ficava sempre NULL, nada preenchia).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_andamento_pendencia_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
BEGIN
  IF NEW.tp_status = OLD.tp_status THEN
    RETURN NEW;
  END IF;

  IF NEW.tp_status = 'concluida' THEN
    NEW.ts_conclusao := now();
  ELSE
    NEW.ts_conclusao := NULL;
  END IF;

  PERFORM soma.fn_registrar_andamento(
    NEW.cd_processo,
    CASE NEW.tp_status
      WHEN 'concluida' THEN 'Pendência concluída'
      WHEN 'atrasada' THEN 'Pendência atrasada'
      ELSE 'Pendência reaberta'
    END,
    NEW.ds_pendencia || '.'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_andamento_pendencia_status
BEFORE UPDATE ON soma.pendencias
FOR EACH ROW EXECUTE PROCEDURE soma.fn_andamento_pendencia_status();
