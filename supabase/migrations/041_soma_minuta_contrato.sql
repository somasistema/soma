-- ================================================================
-- SOMA — Migration 041
-- Fluxo contrato: documentação → minuta (5 frentes aprovam) →
-- contrato final → assinatura (Autentique, ainda não integrado).
--
-- Muda a premissa de que processo só nasce junto com orçamento —
-- processos do tipo "contrato" agora nascem sozinhos (fn_criar_processo),
-- antes de qualquer orçamento existir. O orçamento do Despachante
-- continua entrando em paralelo, depois, via
-- fn_criar_orcamento_complementar (já aceita um cd_processo existente,
-- não precisa mudar nada nela).
--
-- Reprovação de minuta: só o caminho feliz por enquanto (reprovar
-- marca a minuta como reprovada; reenviar uma nova versão é manual,
-- feito pelo Jurídico — não existe fluxo automático de revisão ainda).
-- ================================================================

-- ----------------------------------------------------------------
-- 0) Bug latente: fn_pode_ver_processo nunca ganhou 'gerente' quando a
--    migration 040 criou o perfil — Gerente hoje enxerga processos e
--    orçamentos, mas não documentos/pendências/andamentos/pagamentos
--    (todos dependem desse helper).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_pode_ver_processo(p_cd_processo UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
  SELECT EXISTS (
    SELECT 1 FROM soma.processos p
    WHERE p.cd_processo = p_cd_processo
    AND (
      soma.fn_auth_role() IN ('master', 'juridico', 'gerente')
      OR p.cd_comprador = auth.uid()
      OR p.cd_vendedor = auth.uid()
      OR p.cd_corretor = auth.uid()
      OR p.cd_despachante = auth.uid()
      OR p.cd_imobiliaria = (SELECT cd_imobiliaria FROM soma.usuarios WHERE cd_usuario = auth.uid())
    )
  );
$$;

-- ----------------------------------------------------------------
-- 1) Etapa do contrato — só usada quando tp_processo = 'contrato'.
--    VARCHAR + CHECK (não enum), mesmo padrão que a migration 014 já
--    adotou pra tp_processo.
-- ----------------------------------------------------------------
ALTER TABLE soma.processos
  ADD COLUMN tp_etapa_contrato VARCHAR(20)
  CHECK (tp_etapa_contrato IN (
    'documentacao', 'minuta_pendente', 'minuta_reprovada', 'aguardando_assinatura', 'concluido'
  ));

-- ----------------------------------------------------------------
-- 2) fn_criar_processo — cria um processo "contrato" sozinho, sem
--    orçamento junto. Mesma checagem de permissão que pendencias_insert
--    já usa (master/jurídico/despachante, via perfil_acesso).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_criar_processo(
  p_cd_imobiliaria UUID,
  p_nm_comprador_convidado VARCHAR,
  p_ds_telefone_comprador_convidado VARCHAR,
  p_cd_vendedor UUID DEFAULT NULL,
  p_cd_corretor UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
BEGIN
  IF NOT soma.fn_tem_permissao('processos', 'criar') THEN
    RAISE EXCEPTION 'Seu perfil não tem permissão pra criar processos.';
  END IF;

  INSERT INTO soma.processos (
    tp_processo, cd_imobiliaria, nm_comprador_convidado, ds_telefone_comprador_convidado,
    cd_vendedor, cd_corretor, tp_etapa_contrato
  )
  VALUES (
    'contrato', p_cd_imobiliaria, p_nm_comprador_convidado, p_ds_telefone_comprador_convidado,
    p_cd_vendedor, p_cd_corretor, 'documentacao'
  )
  RETURNING cd_processo INTO v_cd_processo;

  RETURN v_cd_processo;
END;
$$;

-- ----------------------------------------------------------------
-- 3) Minutas — uma linha por versão enviada pro Jurídico.
-- ----------------------------------------------------------------
CREATE TABLE soma.minutas (
  cd_minuta UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  cd_criador UUID REFERENCES soma.usuarios(cd_usuario),
  nr_versao INTEGER NOT NULL,
  ds_storage_url TEXT NOT NULL,
  tp_status VARCHAR(20) NOT NULL DEFAULT 'em_aprovacao'
    CHECK (tp_status IN ('em_aprovacao', 'aprovada', 'reprovada')),
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_minutas_processo ON soma.minutas(cd_processo);

-- ----------------------------------------------------------------
-- 4) Aprovações — 5 linhas por minuta, uma por frente. cd_usuario só
--    é preenchido quando alguém decide (Imobiliária/Jurídico não têm
--    um único usuário fixo no processo, só descobrimos quem foi na
--    hora da decisão).
-- ----------------------------------------------------------------
CREATE TABLE soma.minuta_aprovacoes (
  cd_aprovacao UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_minuta UUID NOT NULL REFERENCES soma.minutas(cd_minuta) ON DELETE CASCADE,
  tp_papel VARCHAR(20) NOT NULL
    CHECK (tp_papel IN ('corretor', 'comprador', 'vendedor', 'imobiliaria', 'juridico')),
  cd_usuario UUID REFERENCES soma.usuarios(cd_usuario),
  tp_status VARCHAR(20) NOT NULL DEFAULT 'pendente'
    CHECK (tp_status IN ('pendente', 'aprovada', 'reprovada')),
  ds_comentario TEXT,
  ts_decisao TIMESTAMPTZ,
  UNIQUE (cd_minuta, tp_papel)
);

CREATE INDEX idx_minuta_aprovacoes_minuta ON soma.minuta_aprovacoes(cd_minuta);

-- ----------------------------------------------------------------
-- 5) Contrato final — gerado automaticamente quando as 5 frentes
--    aprovam (fn_decidir_minuta). v1 não gera PDF novo, só promove o
--    arquivo da minuta aprovada; coluna de assinatura (Autentique)
--    fica pra quando a integração entrar de verdade.
-- ----------------------------------------------------------------
CREATE TABLE soma.contratos (
  cd_contrato UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  cd_minuta UUID NOT NULL REFERENCES soma.minutas(cd_minuta),
  tp_status VARCHAR(20) NOT NULL DEFAULT 'aguardando_assinatura'
    CHECK (tp_status IN ('aguardando_assinatura', 'assinado')),
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_contratos_processo ON soma.contratos(cd_processo);

-- ----------------------------------------------------------------
-- 6) fn_pode_aprovar_papel — quem pode decidir por cada frente.
--    Master sempre pode (bypass, igual o resto do app).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_pode_aprovar_papel(p_cd_processo UUID, p_tp_papel VARCHAR)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_processo soma.processos%ROWTYPE;
  v_role VARCHAR;
  v_cd_imobiliaria_usuario UUID;
BEGIN
  SELECT * INTO v_processo FROM soma.processos WHERE cd_processo = p_cd_processo;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  v_role := soma.fn_auth_role();
  IF v_role = 'master' THEN
    RETURN true;
  END IF;

  CASE p_tp_papel
    WHEN 'corretor' THEN
      RETURN v_processo.cd_corretor = auth.uid();
    WHEN 'comprador' THEN
      RETURN v_processo.cd_comprador = auth.uid();
    WHEN 'vendedor' THEN
      RETURN v_processo.cd_vendedor = auth.uid();
    WHEN 'juridico' THEN
      RETURN v_role = 'juridico';
    WHEN 'imobiliaria' THEN
      IF v_role != 'imobiliaria' THEN
        RETURN false;
      END IF;
      SELECT cd_imobiliaria INTO v_cd_imobiliaria_usuario
      FROM soma.usuarios WHERE cd_usuario = auth.uid();
      RETURN v_cd_imobiliaria_usuario = v_processo.cd_imobiliaria;
    ELSE
      RETURN false;
  END CASE;
END;
$$;

-- ----------------------------------------------------------------
-- 7) fn_enviar_minuta — Jurídico/Master sobem o arquivo (já enviado
--    ao Storage pelo client) e disparam a aprovação das 5 frentes.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_enviar_minuta(
  p_cd_processo UUID,
  p_ds_storage_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_minuta UUID;
  v_nr_versao INTEGER;
BEGIN
  IF soma.fn_auth_role() NOT IN ('master', 'juridico') THEN
    RAISE EXCEPTION 'Só Master ou Jurídico pode enviar minuta.';
  END IF;

  SELECT COALESCE(MAX(nr_versao), 0) + 1 INTO v_nr_versao
  FROM soma.minutas WHERE cd_processo = p_cd_processo;

  INSERT INTO soma.minutas (cd_processo, cd_criador, nr_versao, ds_storage_url)
  VALUES (p_cd_processo, auth.uid(), v_nr_versao, p_ds_storage_url)
  RETURNING cd_minuta INTO v_cd_minuta;

  INSERT INTO soma.minuta_aprovacoes (cd_minuta, tp_papel)
  SELECT v_cd_minuta, papel
  FROM (VALUES ('corretor'), ('comprador'), ('vendedor'), ('imobiliaria'), ('juridico')) AS p(papel);

  UPDATE soma.processos SET tp_etapa_contrato = 'minuta_pendente' WHERE cd_processo = p_cd_processo;

  PERFORM soma.fn_registrar_andamento(
    p_cd_processo,
    'Minuta enviada',
    'Minuta (versão ' || v_nr_versao || ') enviada para aprovação das 5 frentes.'
  );

  RETURN v_cd_minuta;
END;
$$;

-- ----------------------------------------------------------------
-- 8) fn_decidir_minuta — aprovar/reprovar por uma frente. Reprovar
--    exige comentário (checado aqui, não via CHECK de coluna, pra dar
--    mensagem melhor). Quando a última frente aprova, gera o contrato
--    final automaticamente.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_decidir_minuta(
  p_cd_minuta UUID,
  p_tp_papel VARCHAR,
  p_aprovar BOOLEAN,
  p_comentario TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
  v_qtd_pendente INTEGER;
  v_papel_rotulo VARCHAR;
BEGIN
  SELECT cd_processo INTO v_cd_processo FROM soma.minutas WHERE cd_minuta = p_cd_minuta;
  IF v_cd_processo IS NULL THEN
    RAISE EXCEPTION 'Minuta não encontrada.';
  END IF;

  IF NOT soma.fn_pode_aprovar_papel(v_cd_processo, p_tp_papel) THEN
    RAISE EXCEPTION 'Seu perfil não pode decidir pela frente "%".', p_tp_papel;
  END IF;

  IF NOT p_aprovar AND (p_comentario IS NULL OR trim(p_comentario) = '') THEN
    RAISE EXCEPTION 'Informe o motivo da reprovação.';
  END IF;

  UPDATE soma.minuta_aprovacoes
  SET tp_status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'reprovada' END,
      cd_usuario = auth.uid(),
      ds_comentario = p_comentario,
      ts_decisao = now()
  WHERE cd_minuta = p_cd_minuta AND tp_papel = p_tp_papel;

  v_papel_rotulo := initcap(p_tp_papel);

  IF NOT p_aprovar THEN
    UPDATE soma.minutas SET tp_status = 'reprovada' WHERE cd_minuta = p_cd_minuta;
    UPDATE soma.processos SET tp_etapa_contrato = 'minuta_reprovada' WHERE cd_processo = v_cd_processo;
    PERFORM soma.fn_registrar_andamento(
      v_cd_processo,
      'Minuta reprovada',
      v_papel_rotulo || ' reprovou a minuta — Motivo: ' || p_comentario
    );
    RETURN;
  END IF;

  PERFORM soma.fn_registrar_andamento(
    v_cd_processo,
    'Minuta aprovada por uma frente',
    v_papel_rotulo || ' aprovou a minuta.'
  );

  SELECT count(*) INTO v_qtd_pendente
  FROM soma.minuta_aprovacoes
  WHERE cd_minuta = p_cd_minuta AND tp_status != 'aprovada';

  IF v_qtd_pendente = 0 THEN
    UPDATE soma.minutas SET tp_status = 'aprovada' WHERE cd_minuta = p_cd_minuta;
    INSERT INTO soma.contratos (cd_processo, cd_minuta) VALUES (v_cd_processo, p_cd_minuta);
    UPDATE soma.processos SET tp_etapa_contrato = 'aguardando_assinatura' WHERE cd_processo = v_cd_processo;
    PERFORM soma.fn_registrar_andamento(
      v_cd_processo,
      'Contrato final gerado',
      'Todas as 5 frentes aprovaram a minuta — contrato final gerado, aguardando assinatura digital.'
    );
  END IF;
END;
$$;

-- ----------------------------------------------------------------
-- 9) RLS — leitura ampla (mesmo predicado de andamentos/pendências),
--    escrita bloqueada por padrão (só as funções SECURITY DEFINER
--    acima escrevem, mesmo esquema de fn_criar_orcamento).
-- ----------------------------------------------------------------
ALTER TABLE soma.minutas ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.minuta_aprovacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.contratos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minutas_select" ON soma.minutas FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));

CREATE POLICY "minuta_aprovacoes_select" ON soma.minuta_aprovacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.minutas m
      WHERE m.cd_minuta = minuta_aprovacoes.cd_minuta
      AND soma.fn_pode_ver_processo(m.cd_processo)
    )
  );

CREATE POLICY "contratos_select" ON soma.contratos FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));

-- ----------------------------------------------------------------
-- 10) Storage — bucket privado "minutas", mesmo padrão do bucket
--     "documentos" (migration 009). Reaproveita fn_cd_processo_do_path,
--     já definida lá (mesmo schema).
-- ----------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('minutas', 'minutas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "minutas_bucket_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'minutas' AND soma.fn_pode_ver_processo(soma.fn_cd_processo_do_path(name)));

CREATE POLICY "minutas_bucket_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'minutas' AND soma.fn_auth_role() IN ('master', 'juridico'));

CREATE POLICY "minutas_bucket_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'minutas' AND soma.fn_auth_role() IN ('master', 'juridico'));

CREATE POLICY "minutas_bucket_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'minutas' AND soma.fn_auth_role() IN ('master', 'juridico'));
