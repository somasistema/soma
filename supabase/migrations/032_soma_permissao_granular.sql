-- ================================================================
-- SOMA — Migration 032
-- Perfil de acesso deixa de ser só "vê ou não vê a seção" e ganha
-- granularidade de CRUD (ver/criar/editar/excluir) nas 5 seções que
-- têm operações de escrita de verdade: Orçamentos, Processos,
-- Usuários, Serviços, Taxas e Emolumentos. Início e Configurações
-- continuam só com liga/desliga (sn_ver), não têm um "criar/editar"
-- óbvio.
--
-- Isso só vira segurança de verdade se a própria política de RLS (ou
-- a função SECURITY DEFINER, no caso dos orçamentos) consultar essa
-- tabela — por isso essa migration também troca as checagens fixas
-- de "só master" / "master ou jurídico" por soma.fn_tem_permissao(),
-- que lê soma.perfil_acesso dinamicamente (com bypass total pro
-- Master, igual o resto do app já fazia).
--
-- Limitações conhecidas (documentando em vez de fingir cobertura
-- total): "Processos" hoje só governa a criação de pendência — é o
-- único CRUD isolado que existe pra processo hoje; validação de
-- documento e andamentos automáticos continuam com as regras fixas
-- que já tinham. "Orçamentos" não tem exclusão implementada no app
-- ainda, então sn_excluir de Orçamentos não tem efeito por enquanto.
-- ================================================================

ALTER TABLE soma.perfil_acesso RENAME COLUMN sn_ativo TO sn_ver;

ALTER TABLE soma.perfil_acesso
  ADD COLUMN sn_criar BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sn_editar BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN sn_excluir BOOLEAN NOT NULL DEFAULT false;

-- Orçamentos/Usuários/Serviços/Taxas: o sn_ver de cada uma já
-- refletia exatamente quem tinha acesso de escrita hoje (tudo ou
-- nada), então replicar sn_ver nas 3 colunas novas mantém o
-- comportamento atual intacto.
UPDATE soma.perfil_acesso
SET sn_criar = sn_ver, sn_editar = sn_ver, sn_excluir = sn_ver
WHERE cd_secao IN ('orcamentos', 'usuarios', 'servicos', 'boletos');

-- Processos é diferente: sn_ver sempre foi true pra todo perfil (a
-- visibilidade de verdade é linha a linha, via RLS de soma.processos),
-- mas criar pendência sempre foi restrito a master/jurídico/despachante
-- — preserva exatamente essa regra em vez de copiar sn_ver (que
-- deixaria todo mundo criar).
UPDATE soma.perfil_acesso
SET sn_criar = true, sn_editar = true, sn_excluir = true
WHERE cd_secao = 'processos' AND tp_role IN ('juridico', 'despachante');

-- Função central de checagem — Master nunca passa por aqui (bypass
-- total, igual soma.exigirAcessoSecao no app), qualquer outro perfil
-- consulta a linha configurável.
CREATE OR REPLACE FUNCTION soma.fn_tem_permissao(p_secao VARCHAR, p_acao VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_role VARCHAR;
  v_resultado BOOLEAN;
BEGIN
  v_role := soma.fn_auth_role();
  IF v_role = 'master' THEN
    RETURN true;
  END IF;

  EXECUTE format(
    'SELECT sn_%I FROM soma.perfil_acesso WHERE tp_role = $1 AND cd_secao = $2',
    p_acao
  )
  INTO v_resultado
  USING v_role, p_secao;

  RETURN COALESCE(v_resultado, false);
END;
$$;

GRANT EXECUTE ON FUNCTION soma.fn_tem_permissao(VARCHAR, VARCHAR) TO authenticated;

-- ----------------------------------------------------------------
-- Serviços — troca "só master" por soma.fn_tem_permissao('servicos', ...)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "servicos_insert" ON soma.servicos;
CREATE POLICY "servicos_insert" ON soma.servicos FOR INSERT
  WITH CHECK (soma.fn_tem_permissao('servicos', 'criar'));

DROP POLICY IF EXISTS "servicos_update" ON soma.servicos;
CREATE POLICY "servicos_update" ON soma.servicos FOR UPDATE
  USING (soma.fn_tem_permissao('servicos', 'editar'));

DROP POLICY IF EXISTS "servicos_delete" ON soma.servicos;
CREATE POLICY "servicos_delete" ON soma.servicos FOR DELETE
  USING (soma.fn_tem_permissao('servicos', 'excluir'));

DROP POLICY IF EXISTS "servico_precos_insert" ON soma.servico_precos;
CREATE POLICY "servico_precos_insert" ON soma.servico_precos FOR INSERT
  WITH CHECK (soma.fn_tem_permissao('servicos', 'criar'));

DROP POLICY IF EXISTS "servico_precos_update" ON soma.servico_precos;
CREATE POLICY "servico_precos_update" ON soma.servico_precos FOR UPDATE
  USING (soma.fn_tem_permissao('servicos', 'editar'));

DROP POLICY IF EXISTS "servico_precos_delete" ON soma.servico_precos;
CREATE POLICY "servico_precos_delete" ON soma.servico_precos FOR DELETE
  USING (soma.fn_tem_permissao('servicos', 'excluir'));

-- ----------------------------------------------------------------
-- Taxas e Emolumentos (tabela_custas) — mesma troca, seção "boletos"
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "tabela_custas_insert" ON soma.tabela_custas;
CREATE POLICY "tabela_custas_insert" ON soma.tabela_custas FOR INSERT
  WITH CHECK (soma.fn_tem_permissao('boletos', 'criar'));

DROP POLICY IF EXISTS "tabela_custas_update" ON soma.tabela_custas;
CREATE POLICY "tabela_custas_update" ON soma.tabela_custas FOR UPDATE
  USING (soma.fn_tem_permissao('boletos', 'editar'));

DROP POLICY IF EXISTS "tabela_custas_delete" ON soma.tabela_custas;
CREATE POLICY "tabela_custas_delete" ON soma.tabela_custas FOR DELETE
  USING (soma.fn_tem_permissao('boletos', 'excluir'));

-- ----------------------------------------------------------------
-- Pendências — único CRUD isolado de "Processos" hoje
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "pendencias_insert" ON soma.pendencias;
CREATE POLICY "pendencias_insert" ON soma.pendencias FOR INSERT
  WITH CHECK (soma.fn_tem_permissao('processos', 'criar'));

-- ----------------------------------------------------------------
-- fn_criar_orcamento / fn_criar_orcamento_complementar / fn_atualizar_orcamento
-- — trocam o "IN ('master','juridico')" fixo por fn_tem_permissao.
-- CREATE OR REPLACE preserva grants/dependências já existentes.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento(
  p_tp_processo VARCHAR(12),
  p_cd_imobiliaria UUID,
  p_nm_comprador_convidado VARCHAR,
  p_ds_telefone_comprador_convidado VARCHAR,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB,
  p_ds_inscricao_municipal VARCHAR DEFAULT NULL,
  p_vl_transacao NUMERIC DEFAULT NULL,
  p_vl_venal NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
  v_cd_orcamento UUID;
  v_vl_total_honorarios NUMERIC(15,2);
  v_vl_total_custas NUMERIC(15,2);
BEGIN
  IF NOT soma.fn_tem_permissao('orcamentos', 'criar') THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão pra criar orçamentos.';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item de serviço.';
  END IF;

  PERFORM soma.fn_validar_itens_tipo_processo(p_tp_processo, p_itens);

  INSERT INTO soma.processos (tp_processo, cd_imobiliaria, nm_comprador_convidado, ds_telefone_comprador_convidado)
  VALUES (p_tp_processo, p_cd_imobiliaria, p_nm_comprador_convidado, p_ds_telefone_comprador_convidado)
  RETURNING cd_processo INTO v_cd_processo;

  SELECT
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'honorario'), 0),
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'custa'), 0)
  INTO v_vl_total_honorarios, v_vl_total_custas
  FROM jsonb_array_elements(p_itens) AS item;

  INSERT INTO soma.orcamentos (
    cd_processo, cd_criador, nm_cidade, dt_validade, vl_total_honorarios, vl_total_custas,
    ds_inscricao_municipal, vl_transacao, vl_venal
  )
  VALUES (
    v_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas,
    p_ds_inscricao_municipal, p_vl_transacao, p_vl_venal
  )
  RETURNING cd_orcamento INTO v_cd_orcamento;

  INSERT INTO soma.orcamento_servicos (cd_orcamento, cd_servico, ds_descricao, tp_servico, vl_unitario, nr_quantidade, tp_secao)
  SELECT
    v_cd_orcamento,
    NULLIF(item->>'cd_servico', '')::uuid,
    item->>'ds_descricao',
    (item->>'tp_servico')::soma.type_servico,
    (item->>'vl_unitario')::numeric,
    (item->>'nr_quantidade')::integer,
    COALESCE(NULLIF(item->>'tp_secao', ''), 'inicial')
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN v_cd_orcamento;
END;
$$;

CREATE OR REPLACE FUNCTION soma.fn_criar_orcamento_complementar(
  p_cd_processo UUID,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB,
  p_ds_inscricao_municipal VARCHAR DEFAULT NULL,
  p_vl_transacao NUMERIC DEFAULT NULL,
  p_vl_venal NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_orcamento UUID;
  v_tp_processo VARCHAR(12);
  v_vl_total_honorarios NUMERIC(15,2);
  v_vl_total_custas NUMERIC(15,2);
BEGIN
  IF NOT soma.fn_tem_permissao('orcamentos', 'criar') THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão pra criar orçamentos.';
  END IF;

  SELECT tp_processo INTO v_tp_processo FROM soma.processos WHERE cd_processo = p_cd_processo;

  IF v_tp_processo IS NULL THEN
    RAISE EXCEPTION 'Processo não encontrado.';
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item de serviço.';
  END IF;

  PERFORM soma.fn_validar_itens_tipo_processo(v_tp_processo, p_itens);

  SELECT
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'honorario'), 0),
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'custa'), 0)
  INTO v_vl_total_honorarios, v_vl_total_custas
  FROM jsonb_array_elements(p_itens) AS item;

  INSERT INTO soma.orcamentos (
    cd_processo, cd_criador, nm_cidade, dt_validade, vl_total_honorarios, vl_total_custas,
    ds_inscricao_municipal, vl_transacao, vl_venal
  )
  VALUES (
    p_cd_processo, auth.uid(), p_nm_cidade, p_dt_validade, v_vl_total_honorarios, v_vl_total_custas,
    p_ds_inscricao_municipal, p_vl_transacao, p_vl_venal
  )
  RETURNING cd_orcamento INTO v_cd_orcamento;

  INSERT INTO soma.orcamento_servicos (cd_orcamento, cd_servico, ds_descricao, tp_servico, vl_unitario, nr_quantidade, tp_secao)
  SELECT
    v_cd_orcamento,
    NULLIF(item->>'cd_servico', '')::uuid,
    item->>'ds_descricao',
    (item->>'tp_servico')::soma.type_servico,
    (item->>'vl_unitario')::numeric,
    (item->>'nr_quantidade')::integer,
    COALESCE(NULLIF(item->>'tp_secao', ''), 'inicial')
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN v_cd_orcamento;
END;
$$;

CREATE OR REPLACE FUNCTION soma.fn_atualizar_orcamento(
  p_cd_orcamento UUID,
  p_nm_cidade VARCHAR,
  p_dt_validade DATE,
  p_itens JSONB,
  p_ds_inscricao_municipal VARCHAR DEFAULT NULL,
  p_vl_transacao NUMERIC DEFAULT NULL,
  p_vl_venal NUMERIC DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_tp_processo VARCHAR(12);
  v_tp_status VARCHAR(12);
  v_vl_total_honorarios NUMERIC(15,2);
  v_vl_total_custas NUMERIC(15,2);
BEGIN
  IF NOT soma.fn_tem_permissao('orcamentos', 'editar') THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão pra editar orçamentos.';
  END IF;

  SELECT p.tp_processo, o.tp_status INTO v_tp_processo, v_tp_status
  FROM soma.orcamentos o
  JOIN soma.processos p ON p.cd_processo = o.cd_processo
  WHERE o.cd_orcamento = p_cd_orcamento;

  IF v_tp_processo IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  IF v_tp_status != 'pendente' THEN
    RAISE EXCEPTION 'Só é possível editar orçamentos com status pendente (esse já foi % pelo cliente).', v_tp_status;
  END IF;

  IF jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um item de serviço.';
  END IF;

  PERFORM soma.fn_validar_itens_tipo_processo(v_tp_processo, p_itens);

  SELECT
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'honorario'), 0),
    COALESCE(SUM((item->>'vl_unitario')::numeric * (item->>'nr_quantidade')::numeric)
      FILTER (WHERE item->>'tp_servico' = 'custa'), 0)
  INTO v_vl_total_honorarios, v_vl_total_custas
  FROM jsonb_array_elements(p_itens) AS item;

  UPDATE soma.orcamentos
  SET
    nm_cidade = p_nm_cidade,
    dt_validade = p_dt_validade,
    ds_inscricao_municipal = p_ds_inscricao_municipal,
    vl_transacao = p_vl_transacao,
    vl_venal = p_vl_venal,
    vl_total_honorarios = v_vl_total_honorarios,
    vl_total_custas = v_vl_total_custas
  WHERE cd_orcamento = p_cd_orcamento;

  DELETE FROM soma.orcamento_servicos WHERE cd_orcamento = p_cd_orcamento;

  INSERT INTO soma.orcamento_servicos (cd_orcamento, cd_servico, ds_descricao, tp_servico, vl_unitario, nr_quantidade, tp_secao)
  SELECT
    p_cd_orcamento,
    NULLIF(item->>'cd_servico', '')::uuid,
    item->>'ds_descricao',
    (item->>'tp_servico')::soma.type_servico,
    (item->>'vl_unitario')::numeric,
    (item->>'nr_quantidade')::integer,
    COALESCE(NULLIF(item->>'tp_secao', ''), 'inicial')
  FROM jsonb_array_elements(p_itens) AS item;

  RETURN p_cd_orcamento;
END;
$$;
