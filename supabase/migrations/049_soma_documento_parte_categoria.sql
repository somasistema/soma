-- ================================================================
-- SOMA — Migration 049
-- Liga cada documento anexado (soma.documentos) a uma parte do
-- processo (vendedor/comprador de soma.processo_parte) e a uma
-- categoria do checklist do intake.
--
-- Com isso o "OK / Falta" do checklist deixa de ser digitado: se
-- existe documento pra (parte, categoria) => OK; senão => Falta.
--
-- Colunas nullable — upload avulso (sem parte/categoria) continua
-- funcionando igual.
-- ================================================================

ALTER TABLE soma.documentos
  ADD COLUMN cd_parte UUID REFERENCES soma.processo_parte(cd_parte) ON DELETE SET NULL,
  ADD COLUMN tp_categoria_intake VARCHAR(30)
    CHECK (tp_categoria_intake IN (
      'identidade', 'estado_civil', 'comprovante_residencia', 'onus_escritura'
    ));

CREATE INDEX idx_documentos_parte_categoria
  ON soma.documentos(cd_parte, tp_categoria_intake);
