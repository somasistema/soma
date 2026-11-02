-- ================================================================
-- SOMA — Migration 076
-- Termo de Vistoria da locação.
--
--   * soma.vistoria_ambientes / soma.vistoria_fotos: ambientes do imóvel
--     (varanda, sala, quarto...) com a descrição e as fotos de cada um. A
--     equipe cadastra os ambientes e as fotos na aba "Vistoria" do processo
--     de aluguel; a descrição pode ser sugerida pela IA a partir das fotos.
--     Leitura pela RLS do processo; escrita só pelo servidor (service_role).
--   * Modelo "Termo de vistoria — locação": qualificação do locador e do
--     locatário, imóvel e cláusulas do laudo da SOMA. O trecho
--     [[AMBIENTES]] é trocado, na geração do PDF, pelos ambientes com fotos.
--
-- Rodar depois da 075.
-- ================================================================

CREATE TABLE IF NOT EXISTS soma.vistoria_ambientes (
  cd_ambiente UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_processo UUID NOT NULL REFERENCES soma.processos(cd_processo) ON DELETE CASCADE,
  nr_ordem INTEGER NOT NULL DEFAULT 0,
  nm_ambiente VARCHAR(120) NOT NULL,
  ds_descricao TEXT,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL,
  ts_atualizacao TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vistoria_ambientes_processo ON soma.vistoria_ambientes(cd_processo, nr_ordem);

CREATE TABLE IF NOT EXISTS soma.vistoria_fotos (
  cd_foto UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cd_ambiente UUID NOT NULL REFERENCES soma.vistoria_ambientes(cd_ambiente) ON DELETE CASCADE,
  nr_ordem INTEGER NOT NULL DEFAULT 0,
  nm_arquivo VARCHAR(255) NOT NULL,
  ds_storage_url TEXT NOT NULL,
  ts_criacao TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_vistoria_fotos_ambiente ON soma.vistoria_fotos(cd_ambiente, nr_ordem);

DROP TRIGGER IF EXISTS trg_vistoria_ambientes_ts ON soma.vistoria_ambientes;
CREATE TRIGGER trg_vistoria_ambientes_ts BEFORE UPDATE ON soma.vistoria_ambientes
  FOR EACH ROW EXECUTE PROCEDURE soma.fn_atualizar_timestamp();

ALTER TABLE soma.vistoria_ambientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE soma.vistoria_fotos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vistoria_ambientes_select" ON soma.vistoria_ambientes;
CREATE POLICY "vistoria_ambientes_select" ON soma.vistoria_ambientes FOR SELECT
  USING (soma.fn_pode_ver_processo(cd_processo));

DROP POLICY IF EXISTS "vistoria_fotos_select" ON soma.vistoria_fotos;
CREATE POLICY "vistoria_fotos_select" ON soma.vistoria_fotos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM soma.vistoria_ambientes a
    WHERE a.cd_ambiente = vistoria_fotos.cd_ambiente AND soma.fn_pode_ver_processo(a.cd_processo)
  ));

DO $modelo_seed$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM soma.modelos_contrato WHERE nm_modelo = 'Termo de vistoria — locação') THEN
    INSERT INTO soma.modelos_contrato (nm_modelo, ds_descricao, ds_conteudo)
    VALUES (
      'Termo de vistoria — locação',
      'Termo de Vistoria do aluguel. O trecho [[AMBIENTES]] vira a lista de ambientes com descrição e fotos na geração do PDF (aba Vistoria do processo).',
      $modelo$TERMO DE VISTORIA

{{#vendedor_1_pj}}LOCADOR: {{vendedor_1}}, pessoa jurídica de direito privado, {{vendedor_1_tipo_societario}}, inscrita no CNPJ/MF sob nº {{vendedor_1_cpf}}, NIRE nº {{vendedor_1_nire}}, com sede na {{vendedor_1_endereco}}, neste ato representada, {{vendedor_representacao}}, por seus sócios-administradores: {{vendedor_representantes}}{{#vendedor_anuentes}}; com a expressa anuência de seus demais sócios: {{vendedor_anuentes}}{{/vendedor_anuentes}}.{{/vendedor_1_pj}}{{^vendedor_1_pj}}LOCADOR: {{vendedor_1}}, brasileiro, maior, capaz, {{vendedor_1_profissao}}, nascido em {{vendedor_1_nascimento}}, natural de {{vendedor_1_naturalidade}}, filiação de {{vendedor_1_filiacao}}, portador da cédula de identidade nº {{vendedor_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{vendedor_1_cpf}}{{#vendedor_2}}{{#vendedor_2_conjuge}}, casado sob o regime da {{vendedor_2_regime_bens}} com {{/vendedor_2_conjuge}}{{#vendedor_2_companheiro}}, convivente em união estável com {{/vendedor_2_companheiro}}{{#vendedor_2_outro}}, e {{/vendedor_2_outro}}{{#vendedor_2_anuente}}, e, na qualidade de ANUENTE, {{/vendedor_2_anuente}}{{vendedor_2}}, brasileira, maior, capaz, {{vendedor_2_profissao}}, nascida em {{vendedor_2_nascimento}}, natural de {{vendedor_2_naturalidade}}, filiação de {{vendedor_2_filiacao}}, portadora da cédula de identidade nº {{vendedor_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{vendedor_2_cpf}}, ambos residentes e domiciliados na {{vendedor_1_endereco}}{{/vendedor_2}}{{^vendedor_2}}, residente e domiciliado na {{vendedor_1_endereco}}{{/vendedor_2}}.{{/vendedor_1_pj}}

LOCATÁRIO: {{comprador_1}}, brasileiro, maior, capaz, {{comprador_1_profissao}}, {{^comprador_2}}solteiro e declara não conviver em união estável, {{/comprador_2}}nascido em {{comprador_1_nascimento}}, natural de {{comprador_1_naturalidade}}, filiação de {{comprador_1_filiacao}}, portador da cédula de identidade nº {{comprador_1_rg}} SSP/BA, inscrito no CPF/MF sob nº {{comprador_1_cpf}}{{#comprador_2}}{{#comprador_2_conjuge}}, casado sob o regime da {{comprador_2_regime_bens}} com {{/comprador_2_conjuge}}{{#comprador_2_companheiro}}, convivente em união estável com {{/comprador_2_companheiro}}{{#comprador_2_outro}}, e {{/comprador_2_outro}}{{#comprador_2_anuente}}, e, na qualidade de ANUENTE, {{/comprador_2_anuente}}{{comprador_2}}, brasileira, maior, capaz, {{comprador_2_profissao}}, nascida em {{comprador_2_nascimento}}, natural de {{comprador_2_naturalidade}}, filiação de {{comprador_2_filiacao}}, portadora da cédula de identidade nº {{comprador_2_rg}} SSP/BA, inscrita no CPF/MF sob nº {{comprador_2_cpf}}, ambos residentes e domiciliados na {{comprador_1_endereco}}{{/comprador_2}}{{^comprador_2}}, residente e domiciliado na {{comprador_1_endereco}}{{/comprador_2}}.

IMÓVEL: {{imovel_descricao}}, conforme descrito na matrícula nº {{imovel_matricula}} do {{imovel_cartorio_numero}} Cartório de Registro de Imóveis de {{imovel_cartorio_cidade}}/BA. Endereço (IPTU): {{imovel_endereco}}{{#imovel_iptu}} — inscrição municipal nº {{imovel_iptu}}{{/imovel_iptu}}.

Resolvem firmar o presente TERMO DE VISTORIA, que passa a integrar o Contrato de Locação de Imóvel Residencial celebrado entre as partes.

CLÁUSULA PRIMEIRA: ESTADO GERAL DO IMÓVEL

1.1 - Estado geral: Pisos, paredes, tetos, portas, esquadrias, pintura e demais elementos construtivos encontram-se em bom estado de conservação.

1.2 - Instalações elétricas: Tomadas, interruptores, bocais, luminárias e demais pontos elétricos encontram-se em bom estado de conservação e funcionamento.

1.3 - Instalações hidráulicas e sanitárias: Fornecimento de água regular no momento da vistoria. As instalações hidráulicas e sanitárias encontram-se em bom estado de conservação e funcionamento, sem irregularidades constatadas durante a inspeção.

1.4 - Instalações diversas: Esquadrias, vidros, portas e demais elementos permanentes encontram-se em bom estado de conservação e funcionamento.

CLÁUSULA SEGUNDA: DESCRIÇÃO DETALHADA DOS AMBIENTES

[[AMBIENTES]]

CLÁUSULA TERCEIRA - O presente instrumento é parte integrante do Contrato de Locação firmado entre as partes contratantes, e o LOCATÁRIO se responsabiliza integralmente pela conservação e segurança do imóvel, bem como de seu mobiliário e utensílios, arcando com qualquer prejuízo causado por perdas e danos constatados na ocasião da devolução do bem, ressalvadas as deteriorações naturais decorrentes do uso normal. As avarias pré-existentes, devidamente registradas neste laudo ou em imagens anexas, serão de responsabilidade exclusiva do LOCADOR. Em caso de vícios ou avarias não identificados neste termo, mas constatados pelo

LOCATÁRIO em até 7 (sete) dias após o recebimento das chaves, deverá o LOCATÁRIO comunicar formalmente ao LOCADOR.

CLÁUSULA QUARTA - Caso sejam acrescentados móveis ou feitas melhorias no imóvel durante a locação, o LOCADOR e o

LOCATÁRIO deverão registrar esse acréscimo por escrito, com a descrição do que foi incluído e a data da entrega. As melhorias necessárias feitas pelo LOCATÁRIO, desde que autorizadas pelo LOCADOR, poderão ser reembolsadas. Já as melhorias apenas para embelezar ou facilitar o uso (voluptuárias ou úteis) só poderão ser retiradas pelo LOCATÁRIO ao final do contrato se isso não causar danos ao imóvel, salvo se as partes fizerem outro acordo por escrito.

CLÁUSULA QUINTA - O imóvel acima descrito deverá ser entregue pelo LOCATÁRIO ao LOCADOR nas mesmas condições em que o recebeu ({{locacao_devolucao_pintura}}), conforme descrito e documentado neste laudo, incluindo pertences e móveis, mesmo que estes tenham sido entregues após o início da LOCAÇÃO, ressalvado o desgaste natural pelo uso normal.

CLÁUSULA SEXTA - Fica registrado que integram o presente Laudo de Vistoria as imagens fotográficas anexadas, que retratam fielmente o estado de conservação, os móveis, equipamentos e utensílios existentes no imóvel. Fica ainda pactuado que todos os itens constantes nas fotografias, mesmo que não descritos detalhadamente neste laudo, permanecem como parte integrante do imóvel locado e deverão ser restituídos pelo LOCATÁRIO ao término da locação, nas mesmas condições em que foram recebidos, ressalvado o desgaste natural pelo uso regular.

CLÁUSULA SÉTIMA - Fica expressamente estabelecido que qualquer alteração, modificação, benfeitoria ou intervenção no imóvel, ainda que de natureza estética ou funcional, somente poderá ser realizada mediante autorização prévia e expressa do LOCADOR, por escrito. As alterações realizadas sem autorização poderão ensejar a obrigação de restauração do imóvel ao estado original, às expensas do LOCATÁRIO, sem prejuízo de eventuais perdas e danos.

Por estarem justos e contratados, e de pleno acordo com o disposto neste instrumento, assinam o presente em 02 (duas) vias de igual teor e forma, na presença de duas testemunhas, para que se produza o efeito legal.

Salvador (BA), {{data_extenso}}.

LOCADOR

{{#vendedor_1_pj}}_________________________________________ _________________________________________{{/vendedor_1_pj}}{{^vendedor_1_pj}}_________________________________________{{#vendedor_2}} _________________________________________{{/vendedor_2}}{{/vendedor_1_pj}}

{{#vendedor_1_pj}}{{vendedor_1}} — CNPJ/MF Nº {{vendedor_1_cpf}}, representada por {{vendedor_representantes_nomes}}{{#vendedor_anuentes_nomes}}

SÓCIOS ANUENTES: {{vendedor_anuentes_nomes}}{{/vendedor_anuentes_nomes}}{{/vendedor_1_pj}}{{^vendedor_1_pj}}{{vendedor_1}} — CPF/MF Nº {{vendedor_1_cpf}}{{#vendedor_2}}          {{vendedor_2}} — CPF/MF Nº {{vendedor_2_cpf}}{{/vendedor_2}}{{/vendedor_1_pj}}

LOCATÁRIO

_________________________________________{{#comprador_2}} _________________________________________{{/comprador_2}}

{{comprador_1}}{{#comprador_2}}          {{comprador_2}}{{/comprador_2}}

CPF/MF Nº {{comprador_1_cpf}}{{#comprador_2}}          CPF/MF Nº {{comprador_2_cpf}}{{/comprador_2}}

TESTEMUNHAS: _________________________________ _________________________________
$modelo$
    );
  END IF;
END
$modelo_seed$;
