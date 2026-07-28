-- ================================================================
-- SOMA — Migration 012
-- Popula soma.servicos + soma.servico_precos com o catálogo real de
-- serviços do despachante (planilha "Valores Serviços Despachante"),
-- ~180 itens em 10 órgãos (LOCAL) e suas respectivas categorias
-- (TIPO), com preço por cidade (Salvador, Lauro de Freitas, Camaçari).
--
-- Itens cujo valor não é fixo no despachante (ex: "Atos imobiliários
-- por faixa de valor econômico", que seguem a tabela de emolumentos
-- do TJBA) entram como sn_valor_variavel = true, sem preço — quem
-- monta o orçamento digita o valor manualmente.
--
-- Nota: a coluna de checklist de documentos (ds_checklist) da planilha
-- veio cortada no PDF de origem em boa parte das linhas (texto
-- truncado por largura de coluna). Não foi importada nesta migration
-- pra não gravar informação incompleta como se fosse completa — pode
-- ser preenchida depois, serviço a serviço, pela tela de edição.
-- ================================================================

DO $$
DECLARE
  v_cd_servico UUID;
  rec RECORD;
BEGIN
  FOR rec IN SELECT * FROM (VALUES
    -- ============================ CRI — AVERBAÇÃO ============================
    ('09016','CRI','Averbação','Alteração de endereço do imóvel',700,900,1100),
    ('09016','CRI','Averbação','Alteração de inscrição municipal',700,900,1100),
    ('09016','CRI','Averbação','Divórcio (estado civil)',700,900,1100),
    ('09016','CRI','Averbação','Pacto antenupcial',700,900,1100),
    ('09016','CRI','Averbação','Cancelamento de indisponibilidade',700,900,1100),
    ('09016','CRI','Averbação','Cancelamento de usufruto',700,900,1100),
    ('09016','CRI','Averbação','Cancelamento de cláusula resolutiva',700,900,1100),
    ('09016','CRI','Averbação','Cancelamento de caução',700,900,1100),
    ('09016','CRI','Averbação','Cancelamento de alienação fiduciária (baixa de hipoteca)',700,900,1100),
    ('09016','CRI','Averbação','Vinculação de vaga de garagem',700,900,1100),
    ('09016','CRI','Averbação','Carta de sentença',700,900,1100),
    ('09016','CRI','Averbação','Construção/Ampliação',700,900,1100),
    ('070XX','CRI','Averbação','Construção/Ampliação (por faixa)',NULL,NULL,NULL),
    ('13230','CRI','Averbação','Georreferenciamento',700,900,1100),
    ('13234','CRI','Averbação','Retificação de área',700,900,1100),

    -- ============================ CRI — CERTIDÃO ============================
    ('13042','CRI','Certidão','Matrícula / ônus atualizada',70,70,70),
    ('13022','CRI','Certidão','Cadeia sucessória',70,70,70),
    ('13236','CRI','Certidão','Visualização eletrônica de matrícula',40,40,40),

    -- ============================ CRI — OUTROS ============================
    ('13215','CRI','Outros','Abertura de matrícula',1700,2300,2700),
    ('13205','CRI','Outros','Intimação extrajudicial',500,700,900),
    ('13270','CRI','Outros','Monitoramento registral (30 dias)',700,700,700),

    -- ============================ CRI — REGISTRO ============================
    ('08010','CRI','Registro','Registro sem valor econômico',700,900,1100),
    ('08010','CRI','Registro','Convenção de condomínio sem valor declarado',700,900,1100),
    ('08010','CRI','Registro','Pacto antenupcial',700,900,1100),
    ('08010','CRI','Registro','Cláusulas restritivas sem valor econômico',700,900,1100),
    ('11010','CRI','Registro','"Verbo ad verbum" (por página)',700,900,1100),

    ('07015','CRI','Registro','Atos imobiliários (até 1.600,00)',NULL,NULL,NULL),
    ('07035','CRI','Registro','Atos imobiliários (1.600,01 a 3.200,00)',NULL,NULL,NULL),
    ('07048','CRI','Registro','Atos imobiliários (3.200,01 a 8.000,00)',NULL,NULL,NULL),
    ('07052','CRI','Registro','Atos imobiliários (8.000,01 a 12.000,00)',NULL,NULL,NULL),
    ('07056','CRI','Registro','Atos imobiliários (12.000,01 a 16.000,00)',NULL,NULL,NULL),
    ('07064','CRI','Registro','Atos imobiliários (16.000,01 a 24.000,00)',NULL,NULL,NULL),
    ('07072','CRI','Registro','Atos imobiliários (24.000,01 a 32.000,00)',NULL,NULL,NULL),
    ('07080','CRI','Registro','Atos imobiliários (32.000,01 a 47.000,00)',NULL,NULL,NULL),
    ('07089','CRI','Registro','Atos imobiliários (47.000,01 a 63.000,00)',NULL,NULL,NULL),
    ('07099','CRI','Registro','Atos imobiliários (63.000,01 a 78.000,00)',NULL,NULL,NULL),
    ('07100','CRI','Registro','Atos imobiliários (78.000,01 a 118.000,00)',NULL,NULL,NULL),
    ('07102','CRI','Registro','Atos imobiliários (118.000,01 a 160.000,00)',NULL,NULL,NULL),
    ('07110','CRI','Registro','Atos imobiliários (160.000,01 a 235.000,00)',NULL,NULL,NULL),
    ('07129','CRI','Registro','Atos imobiliários (235.000,01 a 350.000,00)',NULL,NULL,NULL),
    ('07137','CRI','Registro','Atos imobiliários (350.000,01 a 530.000,00)',NULL,NULL,NULL),
    ('07145','CRI','Registro','Atos imobiliários (530.000,01 a 800.000,00)',NULL,NULL,NULL),
    ('07153','CRI','Registro','Atos imobiliários (800.000,01 a 1.200.000,00)',NULL,NULL,NULL),
    ('07161','CRI','Registro','Atos imobiliários (1.200.000,01 a 1.800.000,00)',NULL,NULL,NULL),
    ('07170','CRI','Registro','Atos imobiliários (1.800.000,01 a 2.700.000,00)',NULL,NULL,NULL),
    ('07188','CRI','Registro','Atos imobiliários (2.700.000,01 a 4.000.000,00)',NULL,NULL,NULL),
    ('07196','CRI','Registro','Atos imobiliários (acima de 4.000.000,00)',NULL,NULL,NULL),

    ('070XX','CRI','Registro','Compra e venda (escritura pública)',1100,1200,1300),
    ('070XX','CRI','Registro','Consórcio',1500,1600,1700),
    ('070XX','CRI','Registro','Financiamento / alienação fiduciária',1500,1600,1700),
    ('070XX','CRI','Registro','Promessa de compra e venda',1100,1200,1300),
    ('070XX','CRI','Registro','Hipoteca convencional',700,900,1100),
    ('070XX','CRI','Registro','Hipoteca judicial',700,900,1100),
    ('070XX','CRI','Registro','Usufruto com valor',700,900,1100),
    ('070XX','CRI','Registro','Formal de partilha',700,900,1100),
    ('070XX','CRI','Registro','Carta de adjudicação',700,900,1100),
    ('070XX','CRI','Registro','Arrematação judicial',700,900,1100),
    ('071XX','CRI','Registro','Cédula de Crédito Bancário (CCB)',700,900,1100),
    ('071XX','CRI','Registro','Cédula de Crédito Imobiliário (CCI)',700,900,1100),
    ('071XX','CRI','Registro','Cédula de Crédito Comercial (CCC)',700,900,1100),
    ('10014','CRI','Registro','Loteamento',5000,6000,7000),
    ('10020','CRI','Registro','Desmembramento / desdobro urbano',1500,2000,2500),
    ('10030','CRI','Registro','Desmembramento / desdobro rural',3000,3500,4000),
    ('13241','CRI','Registro','Usucapião extrajudicial ou judicial',700,900,1100),
    ('071XX','CRI','Registro','Inventário extrajudicial ou judicial',700,900,1100),
    ('13241','CRI','Registro','Adjudicação compulsória extrajudicial ou judicial',700,900,1100),

    -- ============================ CRI — SERVIÇO ============================
    ('13044','CRI','Serviço','Pesquisa/busca',100,100,100),

    -- ============================ NOTAS — ESCRITURA ============================
    ('1020','NOTAS','Escritura','Atos com valor econômico (até 1.600,00)',NULL,NULL,NULL),
    ('1030','NOTAS','Escritura','Atos com valor econômico (de 1.600,01 a 3.200,00)',NULL,NULL,NULL),
    ('1040','NOTAS','Escritura','Atos com valor econômico (de 3.200,01 a 8.000,00)',NULL,NULL,NULL),
    ('1049','NOTAS','Escritura','Atos com valor econômico (de 8.000,01 a 12.000,00)',NULL,NULL,NULL),
    ('1058','NOTAS','Escritura','Atos com valor econômico (de 12.000,01 a 16.000,00)',NULL,NULL,NULL),
    ('1066','NOTAS','Escritura','Atos com valor econômico (de 16.000,01 a 24.000,00)',NULL,NULL,NULL),
    ('1074','NOTAS','Escritura','Atos com valor econômico (de 24.000,01 a 32.000,00)',NULL,NULL,NULL),
    ('1082','NOTAS','Escritura','Atos com valor econômico (de 32.000,01 a 47.000,00)',NULL,NULL,NULL),
    ('1086','NOTAS','Escritura','Atos com valor econômico (de 47.000,01 a 63.000,00)',NULL,NULL,NULL),
    ('1090','NOTAS','Escritura','Atos com valor econômico (de 63.000,01 a 78.000,00)',NULL,NULL,NULL),
    ('1097','NOTAS','Escritura','Atos com valor econômico (de 78.000,01 a 118.000,00)',NULL,NULL,NULL),
    ('1104','NOTAS','Escritura','Atos com valor econômico (de 118.000,01 a 160.000,00)',NULL,NULL,NULL),
    ('1112','NOTAS','Escritura','Atos com valor econômico (de 160.000,01 a 235.000,00)',NULL,NULL,NULL),
    ('1120','NOTAS','Escritura','Atos com valor econômico (de 235.000,01 a 350.000,00)',NULL,NULL,NULL),
    ('1139','NOTAS','Escritura','Atos com valor econômico (de 350.000,01 a 530.000,00)',NULL,NULL,NULL),
    ('1147','NOTAS','Escritura','Atos com valor econômico (de 530.000,01 a 800.000,00)',NULL,NULL,NULL),
    ('1155','NOTAS','Escritura','Atos com valor econômico (de 800.000,01 a 1.200.000,00)',NULL,NULL,NULL),
    ('1163','NOTAS','Escritura','Atos com valor econômico (de 1.200.000,01 a 1.800.000,00)',NULL,NULL,NULL),
    ('1171','NOTAS','Escritura','Atos com valor econômico (de 1.800.000,01 a 2.700.000,00)',NULL,NULL,NULL),
    ('1180','NOTAS','Escritura','Atos com valor econômico (de 2.700.000,01 a 4.000.000,00)',NULL,NULL,NULL),
    ('1198','NOTAS','Escritura','Atos com valor econômico (acima de 4.000.000,01)',NULL,NULL,NULL),

    ('XXXX','NOTAS','Escritura','Compra e Venda',1000,1600,1900),
    ('XXXX','NOTAS','Escritura','Doação / Usufruto',1300,1500,1700),
    ('XXXX','NOTAS','Escritura','Permuta',1800,2200,2500),
    ('XXXX','NOTAS','Escritura','Escrituras declaratórias (em geral)',800,1100,1300),
    ('XXXX','NOTAS','Escritura','Quitação',800,1100,1300),
    ('XXXX','NOTAS','Escritura','Dação em pagamento',1300,1500,1700),
    ('XXXX','NOTAS','Escritura','Cessão de direitos',1000,1600,1900),
    ('XXXX','NOTAS','Escritura','Confissão/Reconhecimento de dívida',800,1100,1300),

    -- ============================ NOTAS — PROCURAÇÃO ============================
    ('4014','NOTAS','Procuração','Procuração simples / substabelecimento',500,500,500),
    ('4022','NOTAS','Procuração','Outorgante adicional',250,250,250),
    ('4033','NOTAS','Procuração','Revogação / renúncia',250,250,250),
    ('4050','NOTAS','Procuração','Procuração INSS (isenta)',250,250,250),

    -- ============================ NOTAS — CERTIDÃO ============================
    ('5011','NOTAS','Certidão','Certidão / traslado / cópia',180,180,180),

    -- ============================ NOTAS — SERVIÇO ============================
    ('5012','NOTAS','Serviço','Pesquisa / busca',70,70,70),
    ('2011','NOTAS','Serviço','Atos sem valor econômico',NULL,NULL,NULL),
    ('2011','NOTAS','Serviço','Declaração simples',800,1100,1300),
    ('2011','NOTAS','Serviço','Declaração de residência',800,1100,1300),
    ('2011','NOTAS','Serviço','Declaração de estado civil',800,1100,1300),
    ('2011','NOTAS','Serviço','Declaração de inexistência de bens',800,1100,1300),
    ('2011','NOTAS','Serviço','Autorização (ex.: viagem, uso, etc.)',800,1100,1300),
    ('2011','NOTAS','Serviço','Anuência',800,1100,1300),
    ('6106','NOTAS','Serviço','Pública forma (por página)',80,150,180),
    ('40000','NOTAS','Serviço','Apostilamento de Haia',3000,3000,3000),

    -- ============================ NOTAS — FIRMA / AUTENTICAÇÃO ============================
    ('6017','NOTAS','Firma','Reconhecimento por semelhança',80,150,180),
    ('6025','NOTAS','Autenticação','Autenticação de cópia física',80,150,180),
    ('6030','NOTAS','Autenticação','Autenticação eletrônica (CENAD)',80,150,180),

    -- ============================ NOTAS — ATA NOTARIAL ============================
    ('6300','NOTAS','Ata Notarial','Ata (até 5 páginas)',1700,1700,1700),
    ('6301','NOTAS','Ata Notarial','Ata (página adicional)',1700,1700,1700),

    -- ============================ RCPN ============================
    ('30020','RCPN','Certidão','2ª via simples DIGITAL (nascimento, casamento, divórcio e óbito)',80,80,80),
    ('30020','RCPN','Certidão','2ª via simples FÍSICA (nascimento, casamento, divórcio e óbito)',180,280,380),
    ('30023','RCPN','Certidão','2ª via simples com busca (nascimento, casamento, divórcio e óbito)',150,250,300),
    ('30031','RCPN','Certidão','Inteiro Teor DIGITAL (nascimento, casamento, divórcio e óbito)',80,80,80),
    ('30031','RCPN','Certidão','Inteiro Teor FISICA (nascimento, casamento, divórcio e óbito)',180,280,380),
    ('30040','RCPN','Serviço','Busca (nascimento, casamento, divórcio e óbito)',120,120,120),
    ('31030','RCPN','Outros','Apostilamento de Haia',3000,3000,3000),
    ('28015','RCPN','Averbação','Divórcio (por mandado judicial ou escritura pública)',700,900,1100),
    ('28015','RCPN','Averbação','Óbito (anotação em outros registros)',700,900,1100),
    ('28015','RCPN','Averbação','Retificação administrativa simples',700,900,1100),
    ('31005','RCPN','Averbação','Retificação extrajudicial de registro civil',700,900,1100),
    ('30020','RCPN','Certidões','Certidão em geral ou cópia de documento arquivados de certidão de cartório diverso',180,280,380),
    ('30023','RCPN','Certidões','Certidão em geral com busca',150,250,300),

    -- ============================ SEFAZ — IPTU ============================
    ('SEF01','SEFAZ','IPTU','Abertura de inscrição municipal',1700,2500,3200),
    ('SEF02','SEFAZ','IPTU','Atualização cadastral do imóvel',600,800,1100),
    ('SEF03','SEFAZ','IPTU','Alteração de titularidade',600,800,1100),
    ('SEF04','SEFAZ','IPTU','Alteração de endereço do imóvel',600,800,1100),
    ('SEF05','SEFAZ','IPTU','Correção de dados cadastrais',600,800,1100),
    ('SEF06','SEFAZ','IPTU','Cancelamento de inscrição municipal (duplicidade)',600,800,1100),
    ('SEF07','SEFAZ','IPTU','Revisão de valor venal',3000,3300,3500),
    ('SEF08','SEFAZ','IPTU','Impugnação administrativa',3000,3300,3500),
    ('SEF09','SEFAZ','IPTU','Consulta de débitos (presencialmente)',250,300,350),
    ('SEF10','SEFAZ','IPTU','Restituição de valores',800,800,800),
    ('SEF11','SEFAZ','IPTU','Transferência de crédito',800,800,800),
    ('SEF12','SEFAZ','IPTU','Compensação de crédito',800,800,800),
    ('SEF13','SEFAZ','IPTU','Consulta valor venal IPTU',50,50,50),

    -- ============================ SEFAZ — BOLETO ============================
    ('SEF14','SEFAZ','Boleto','Emissão de IPTU (2ª via)',20,20,20),
    ('SEF15','SEFAZ','Boleto','Emissão DAM Divida Ativa IPTU',20,20,20),
    ('SEF16','SEFAZ','Boleto','Emissão DAM ITIV (ou 2ª via)',50,50,50),
    ('SEF17','SEFAZ','Boleto','Emissão DAM complementar ITIV',50,50,50),

    -- ============================ SEFAZ — ITIV ============================
    ('SEF18','SEFAZ','ITIV','Transferência de crédito do ITIV',800,800,800),
    ('SEF19','SEFAZ','ITIV','Restituição do ITIV',800,800,800),
    ('SEF20','SEFAZ','ITIV','Compensação de crédito do ITIV',800,800,800),
    ('SEF21','SEFAZ','ITIV','Revisão de DAM do ITIV',3000,3300,3500),
    ('SEF22','SEFAZ','ITIV','Revisão de valor venal',3000,3300,3500),
    ('SEF23','SEFAZ','ITIV','Consulta valor venal ITIV',50,NULL,NULL),

    -- ============================ SEFAZ — CERTIDÃO / DECLARAÇÃO / SERVIÇO ============================
    ('SEF24','SEFAZ','Certidão','Certidão negativa de débitos IPTU',20,20,20),
    ('SEF25','SEFAZ','Certidão','Certidão positiva com efeito de negativa IPTU',20,20,20),
    ('SEF26','SEFAZ','Certidão','Dados cadastrais da inscrição municipal',20,20,20),
    ('SEF27','SEFAZ','Certidão','Regularidade fiscal (PF, PJ e imóvel)',20,20,20),
    ('SEF28','SEFAZ','Certidão','Certidão de inteiro teor (cadastro imobiliário)',20,20,20),
    ('SEF29','SEFAZ','Declaração','Declaração de não inscrito',20,20,20),
    ('SEF30','SEFAZ','Declaração','Declaração de quitação de ITIV',20,20,20),
    ('SEF31','SEFAZ','Declaração','Declaração de transação imobiliária',20,20,20),
    ('SEF32','SEFAZ','Serviço','Cancelamento de foro/laudêmio',180,280,380),

    -- ============================ SEDUR ============================
    ('SED01','SEDUR','Serviço','Habite-se (2ª via)',150,220,280),
    ('SED02','SEDUR','Serviço','Busca de habite-se',150,220,280),

    -- ============================ RF ============================
    ('RF01','RF','Certidão','Certidão negativa de débitos (CND)',20,20,20),
    ('RF02','RF','Certidão','Certidão positiva com efeitos de negativa (CPEN)',20,20,20),

    -- ============================ TJ ============================
    ('TJ01','TJ','Certidão','Certidão de ações cíveis estaduais',20,20,20),
    ('TJ02','TJ','Certidão','Certidão de ações criminais estaduais',20,20,20),
    ('TJ03','TJ','Certidão','Certidão de execuções fiscais estaduais',20,20,20),
    ('TJ04','TJ','Certidão','Certidão de interdição e tutela',20,20,20),
    ('TJ05','TJ','Certidão','Certidão de falência e recuperação judicial',20,20,20),

    -- ============================ TRT ============================
    ('TRT01','TRT','Certidão','Certidão Negativa de Débitos Trabalhistas (CNDT)',20,20,20),
    ('TRT02','TRT','Certidão','Certidão Positiva com Efeito de Negativa de Débitos Trabalhistas',20,20,20),
    ('TRT03','TRT','Consulta','Ações Trabalhistas',20,20,20),

    -- ============================ TRF ============================
    ('TRF01','TRF','Certidão','Certidão de Distribuição Cível Federal',20,20,20),
    ('TRF02','TRF','Certidão','Certidão de Distribuição Criminal Federal',20,20,20),

    -- ============================ SOMA ============================
    ('SOM01','SOMA','Serviço','Análise de certidão de ônus',100,100,100),
    ('SOM02','SOMA','Serviço','Análise documental completa',300,300,300),
    ('SOM03','SOMA','Serviço','Análise documental simples',200,200,200),
    ('SOM04','SOMA','Serviço','Boleto Quitação da Caixa',300,300,300),
    ('SOM05','SOMA','Serviço','Diligência documental',400,600,800),
    ('SOM06','SOMA','Serviço','Acompanhamento bancário',300,300,300),
    ('SOM07','SOMA','Serviço','Organização documental',100,100,100)

  ) AS t(cd_codigo, tp_local, nm_categoria, nm_servico, vl_salvador, vl_lauro, vl_camacari)
  LOOP
    INSERT INTO soma.servicos (cd_codigo, tp_local, nm_categoria, nm_servico, tp_servico, sn_valor_variavel, sn_ativo)
    VALUES (
      rec.cd_codigo, rec.tp_local, rec.nm_categoria, rec.nm_servico, 'honorario',
      (rec.vl_salvador IS NULL AND rec.vl_lauro IS NULL AND rec.vl_camacari IS NULL),
      true
    )
    RETURNING cd_servico INTO v_cd_servico;

    IF rec.vl_salvador IS NOT NULL THEN
      INSERT INTO soma.servico_precos (cd_servico, nm_cidade, vl_valor) VALUES (v_cd_servico, 'Salvador', rec.vl_salvador);
    END IF;
    IF rec.vl_lauro IS NOT NULL THEN
      INSERT INTO soma.servico_precos (cd_servico, nm_cidade, vl_valor) VALUES (v_cd_servico, 'Lauro de Freitas', rec.vl_lauro);
    END IF;
    IF rec.vl_camacari IS NOT NULL THEN
      INSERT INTO soma.servico_precos (cd_servico, nm_cidade, vl_valor) VALUES (v_cd_servico, 'Camaçari', rec.vl_camacari);
    END IF;
  END LOOP;
END $$;
