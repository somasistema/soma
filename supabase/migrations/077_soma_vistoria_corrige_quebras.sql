-- ================================================================
-- SOMA — Migration 077
-- Termo de vistoria — locação (076): duas frases das cláusulas Terceira e
-- Quarta estavam partidas em dois parágrafos ("constatados pelo" / "LOCATÁRIO").
-- Isso veio do laudo antigo, copiado de um PDF. Junta as linhas.
--
-- Só troca esses dois trechos exatos: se o modelo já foi editado pela tela de
-- modelos e não tem mais a quebra, nada muda. Rodar depois da 076.
-- ================================================================

UPDATE soma.modelos_contrato
SET ds_conteudo = replace(
      replace(
        ds_conteudo,
        E'constatados pelo\n\nLOCATÁRIO em até',
        'constatados pelo LOCATÁRIO em até'
      ),
      E'o LOCADOR e o\n\nLOCATÁRIO deverão',
      'o LOCADOR e o LOCATÁRIO deverão'
    )
WHERE nm_modelo = 'Termo de vistoria — locação'
  AND (ds_conteudo LIKE E'%constatados pelo\n\nLOCATÁRIO em até%'
    OR ds_conteudo LIKE E'%o LOCADOR e o\n\nLOCATÁRIO deverão%');
