-- ================================================================
-- SOMA — Migration 044
-- Reconhecimento óptico de caracteres (OCR) dos documentos do
-- processo. Ao subir um documento (soma.documentos), um worker no
-- próprio app (Tesseract.js, self-hosted — sem serviço de terceiro,
-- ver compromisso "sem lock-in" da Proposta Técnica) extrai o texto,
-- detecta o tipo (RG, CPF, matrícula...) e tenta ler os campos
-- estruturados (CPF, nome, nº da matrícula etc.).
--
-- Escrita só pelo worker (client service_role, ignora RLS, mesmo
-- esquema do webhook do Mercado Pago). Leitura acompanha quem já
-- enxerga o documento. A confirmação/edição manual de um campo passa
-- por uma função SECURITY DEFINER (mesma barreira de quem valida
-- documento: Master, Jurídico ou o Despachante do processo).
-- ================================================================

-- ----------------------------------------------------------------
-- 1) Resultado do OCR — uma linha por documento (1:1).
-- ----------------------------------------------------------------
CREATE TABLE soma.documento_ocr (
  cd_documento_ocr UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_documento UUID NOT NULL UNIQUE REFERENCES soma.documentos(cd_documento) ON DELETE CASCADE,
  tp_status VARCHAR(20) NOT NULL DEFAULT 'na_fila'
    CHECK (tp_status IN ('na_fila', 'processando', 'concluido', 'falha')),
  -- rg | cpf | cnh | comprovante_residencia | matricula_imovel |
  -- certidao | contrato_social | outro
  tp_documento_detectado VARCHAR(30),
  ds_texto_extraido TEXT,
  nr_confianca NUMERIC(5, 2),          -- média do Tesseract, 0–100
  nr_paginas INTEGER,
  ds_erro TEXT,
  ds_motor VARCHAR(40) NOT NULL DEFAULT 'tesseract.js',
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_processamento TIMESTAMPTZ
);

CREATE INDEX idx_documento_ocr_documento ON soma.documento_ocr(cd_documento);
CREATE INDEX idx_documento_ocr_status ON soma.documento_ocr(tp_status);

-- ----------------------------------------------------------------
-- 2) Campos lidos — melhor palpite por campo (nome, cpf, rg,
--    data_nascimento, cep, endereco, matricula, cartorio, ...).
--    Um campo por nome; o parser guarda só o de maior confiança.
-- ----------------------------------------------------------------
CREATE TABLE soma.documento_ocr_campos (
  cd_campo UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_documento_ocr UUID NOT NULL REFERENCES soma.documento_ocr(cd_documento_ocr) ON DELETE CASCADE,
  nm_campo VARCHAR(40) NOT NULL,
  ds_valor TEXT NOT NULL,
  nr_confianca NUMERIC(5, 2),
  sn_confirmado BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (cd_documento_ocr, nm_campo)
);

CREATE INDEX idx_documento_ocr_campos_ocr ON soma.documento_ocr_campos(cd_documento_ocr);

-- ----------------------------------------------------------------
-- 3) fn_confirmar_campo_ocr — o validador confere/ajusta um campo.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION soma.fn_confirmar_campo_ocr(p_cd_campo UUID, p_ds_valor TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = soma, public AS $$
DECLARE
  v_cd_processo UUID;
BEGIN
  SELECT d.cd_processo INTO v_cd_processo
  FROM soma.documento_ocr_campos c
  JOIN soma.documento_ocr o ON o.cd_documento_ocr = c.cd_documento_ocr
  JOIN soma.documentos d ON d.cd_documento = o.cd_documento
  WHERE c.cd_campo = p_cd_campo;

  IF v_cd_processo IS NULL THEN
    RAISE EXCEPTION 'Campo de OCR não encontrado.';
  END IF;

  IF soma.fn_auth_role() NOT IN ('master', 'juridico')
     AND NOT EXISTS (
       SELECT 1 FROM soma.processos p
       WHERE p.cd_processo = v_cd_processo AND p.cd_despachante = auth.uid()
     ) THEN
    RAISE EXCEPTION 'Seu perfil não pode confirmar campos de OCR.';
  END IF;

  IF p_ds_valor IS NULL OR trim(p_ds_valor) = '' THEN
    RAISE EXCEPTION 'Informe o valor do campo.';
  END IF;

  UPDATE soma.documento_ocr_campos
  SET ds_valor = trim(p_ds_valor), sn_confirmado = true, nr_confianca = 100
  WHERE cd_campo = p_cd_campo;
END;
$$;

-- ----------------------------------------------------------------
-- 4) RLS — leitura acompanha soma.documentos_select; escrita fica só
--    com o worker (service_role) e com a função acima.
-- ----------------------------------------------------------------
ALTER TABLE soma.documento_ocr ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.documento_ocr_campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documento_ocr_select" ON soma.documento_ocr FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.documentos d
      WHERE d.cd_documento = documento_ocr.cd_documento
      AND (
        soma.fn_auth_role() IN ('master', 'juridico')
        OR soma.fn_pode_ver_processo(d.cd_processo)
      )
    )
  );

CREATE POLICY "documento_ocr_campos_select" ON soma.documento_ocr_campos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM soma.documento_ocr o
      JOIN soma.documentos d ON d.cd_documento = o.cd_documento
      WHERE o.cd_documento_ocr = documento_ocr_campos.cd_documento_ocr
      AND (
        soma.fn_auth_role() IN ('master', 'juridico')
        OR soma.fn_pode_ver_processo(d.cd_processo)
      )
    )
  );
