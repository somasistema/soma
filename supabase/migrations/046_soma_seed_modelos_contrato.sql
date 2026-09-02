-- ================================================================
-- SOMA — Migration 046 (seed)
-- Importa os modelos de contrato da SOMA pra produção (arquivos
-- originais em .docx/.pdf, texto extraído verbatim). Ver migration
-- 043 pra estrutura de soma.modelos_contrato.
--
-- Os campos a preencher no fechamento continuam como no original
-- (XXXX / 0000 / _____). Pra ativar o preenchimento automático da
-- minuta, o Jurídico edita o modelo na tela e troca por {{comprador}},
-- {{vendedor}}, {{corretor}}, {{imobiliaria}}, {{data_extenso}} etc.
--
-- Idempotente: não duplica se rodar de novo (checa nm_modelo).
-- ================================================================

INSERT INTO soma.modelos_contrato (nm_modelo, ds_descricao, ds_conteudo)
SELECT
  'Honorários de corretagem — compra e venda',
  'Contrato de honorários de intermediação (unificado: financiamento e à vista). Firmado entre o vendedor/contratante e a imobiliária.',
  $modelo$CONTRATO DE HONORÁRIOS DE SERVIÇOS IMOBILIÁRIOS E INTERMEDIAÇÃO DE COMPRA E VENDA DE IMÓVEL

CLÁUSULA 1ª- DAS PARTES:

De um lado, XXXXXX, brasileiro, maior, capaz, profissão, nascido em 000, natural de XX, filiação de XXXXX, portador da cédula de identidade nº 000 SSP/BA, inscrito no CPF/MF sob nº 0000, casado sob o regime da comunhão parcial de bens com XXXXX, brasileira, maior, capaz, profissão, nascida em 0000, natural de XX, filiação de xxxx, portadora da cédula de identidade nº 000 SSP/BA, inscrita no CPF/MF sob nº 0000, ambos residentes e domiciliados na xxxx. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como CONTRATANTE.

De outro lado, SIMONE NASCIMENTO LIMA SOLUÇÕES IMOBILIARIAS LTDA, pessoa jurídica, inscrita regularmente no CRECI-PJ/BA nº 1617, CNPJ sob nº 17.873.416/0001-17, com sede na Rua dos Colibris, n 79, Edifício Empresarial Paralela Place, Sala 603, Imbuí, Salvador/BA, CEP 41.720-060, XXXXXXX, brasileira, maior, capaz, corretora de imóveis, CRECI-PF/BA 0000, CPF/MF sob nº 00000, residente e domiciliada nesta Capital e XXXXXXX, brasileira, maior, capaz, corretora de imóveis, CRECI-PF/BA 0000, CPF/MF sob nº 00000, residente e domiciliada nesta Capital. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como CONTRATADO.

CLÁUSULA 2ª - OBJETO DO CONTRATO

DESCRIÇÃO contendo a respectiva descrição e caracterização contida em certidão de ônus versando matrícula n. 000 emitida pelo 0º Registro de Imóveis da Comarca de Salvador/BA.

2.1 - Endereço (IPTU):

CLÁUSULA 3ª - CONDIÇÕES E DIVULGAÇÃO DA INTERMEDIAÇÃO

A intermediação ora contratada é realizada em caráter de exclusividade, apenas se tratando do(s) cliente(s) XXXXX inscrito no CPF/MF sob nº 0000 e XXXXXX inscrita no CPF/MF sob nº 0000. Obrigando-se o CONTRATANTE a não tratarem sobre a venda, direta ou indiretamente, com mais ninguém, sob pena de pagar os honorários ao CONTRATADO, como se fosse eles que tivessem concretizado o negócio.

3.1 - O CONTRATANTE declara que já concedeu previamente autorização formal para que o CONTRATADO realize a divulgação do imóvel, incluindo todos os meios disponíveis, visitas e demais ações necessárias à comercialização. Este contrato tem como objetivo definir a remuneração dos corretores pela intermediação junto ao CONTRATANTE.

CLÁUSULA 4ª - VALOR DO IMÓVEL E CONDIÇÕES DE PAGAMENTO

A transação objeto deste instrumento contratual deverá ser concretizada pelo preço total de R$00.000,00 (000 mil reais)

CLÁUSULA 5ª - FECHAMENTO E SINAL DE NEGÓCIO

O CONTRATADO não poderá fechar o negócio, devendo solicitar o aceite expresso do CONTRATANTE no caso de propostas de negócio.

CLÁUSULA 6ª - HONORÁRIOS DO CONTRATADO

Pela intermediação ora acertada e em comum acordo, o CONTRATANTE pagará ao CONTRATADO, a título de honorários, R$ 000,00 (XXXXX), que deverá ser pago no ato da assinatura do contrato de financiamento. Pagamento este que será realizado da seguinte forma:

a) O valor de R$ 000,00 (XXXXX) deverá ser transferido para o PIX (CPNJ) 17.873.416/0001-17, de titularidade de SIMONE NASCIMENTO LIMA SOLUÇÕES IMOBILIARIAS LTDA.

b) O valor de R$6.600,00 (seis mil e seiscentos reais) deverá ser transferido para a conta da XXXXX, agência 000, operação 000, conta XXXX 00-0 ou PIX (XXX) 000000, de titularidade de XXXXXXX.

6.1 - Caso o CONTRATANTE não pague os honorários estipulados no Contrato poderá o CONTRATADO, promover a respectiva cobrança através dos meios que dispuser, sejam eles judiciais ou extrajudiciais, ficando o CONTRATANTE responsável pelo pagamento de todas à custa que se fizeram necessárias para esse fim, inclusive por honorários advocatícios e de protesto, se existirem.

6.2 - Ultrapassando o prazo de pagamento constante no caput desta cláusula, indicará a partir do primeiro dia útil subsequente sobre o valor dos honorários, multa de 2%, mais mora de 1% a.m., os quais deverão ser pagos diretamente aos CONTRATADOS independente de interpelação judicial.

CLÁUSULA 7ª - DA VIGÊNCIA CONTRATUAL

O presente contrato é válido pelo prazo de 60 (sessenta) dias, iniciada a contagem desse período a partir de sua assinatura do presente termo.

CLÁUSULA 8ª - DO SUBSTABELECIMENTO

É VEDADO O SUBSTABELECIMENTO DO PRESENTE TERMO.

CLÁUSULA 9ª - DO FORO

As partes elegem o Foro da Comarca de SALVADOR/BA para dirimir qualquer dúvida sobre este instrumento.

E por estarem assim justas e contratadas as partes assinam o presente contrato em duas vias de igual teor e forma, na presença de testemunhas.

Salvador/BA, _____ de de 2026.

CONTRATANTE

_______________________________________________ ______________________________________________

XXXXXXXXXX XXXXXXXXXXXXXXXXX

CPF/MF N° 000 CPF/MF Nº 00000

CONTRATADO

_______________________________________________ ______________________________________________

SIMONE NASCIMENTO SOLUÇÕES IMOBILIÁRIAS XXXXXXXXX

CRECI-PJ/BA 1617 CRECI-PF/BA 000000

__________________________________________

XXXXXXXX

CRECI-PF/BA 0000

TESTEMUNHAS____________________________________ _____________________________________$modelo$
WHERE NOT EXISTS (SELECT 1 FROM soma.modelos_contrato WHERE nm_modelo = 'Honorários de corretagem — compra e venda');

INSERT INTO soma.modelos_contrato (nm_modelo, ds_descricao, ds_conteudo)
SELECT
  'Promessa de compra e venda — particular (escritura)',
  'Instrumento particular de promessa de compra e venda para negócio à vista/recursos próprios, com pagamento via Escritura Pública em Tabelionato de Notas.',
  $modelo$INSTRUMENTO PARTICULAR DE PROMESSA DE COMPRA E VENDA

Pelo presente instrumento particular e na melhor forma de direito, fazem as partes entre si nomeadas e qualificadas na forma abaixo:

CLÁUSULA PRIMEIRA - DAS PARTES

De um lado, XXXXXX, brasileiro, maior, capaz, profissão, nascido em XXX, filiação de XXX, portador da cédula de identidade nº 0000 SSP/BA, inscrito no CPF/MF sob nº 0000, casado sob o regime da XXXX com XXXX, brasileira, maior, capaz, profissão, nascida em XXXX, filiação de XXXX, portadora da cédula de identidade nº 0000 SSP/BA, inscrita no CPF/MF sob nº 0000, ambos residentes e domiciliados em XXXX. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como PROMITENTE VENDEDOR.

De outro lado, XXXX, brasileiro, maior, capaz, profissão, solteira e declara não conviver em união estável, nascido em 0000, filiação de xxxx, portador da cédula de identidade nº xxx SSP/BA, inscrito no CPF/MF sob nº xxxx, residente e domiciliado em xxxx. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como PROMITENTE COMPRADOR.

Assim, PROMITENTE VENDEDOR e PROMITENTE COMPRADOR RESOLVEM entre si justos e contratados o seguinte:

CLÁUSULA SEGUNDA - DO IMÓVEL

[DADOS DO IMÓVEL], conforme descrito na matrícula nº XXX do 0º Cartório de Registro de Imóveis de Salvador/BA.

2.1 - Endereço (IPTU):

CLÁUSULA TERCEIRA – DO PREÇO E FORMA DE PAGAMENTO

Conforme acordado entre as partes, o PROMITENTE COMPRADOR efetuará o pagamento do imóvel objeto deste Instrumento ao PROMITENTE VENDEDOR, o preço total de R$ 000.000,00 (xxx), por meio de transferência bancária para a conta do BANCO XXX, AGÊNCIA 000, CONTA XX 00-0 de titularidade do PROMITENTE VENDEDOR, da seguinte forma:

R$ 000.000,00 (xxx) a título de sinal em favor do PROMITENTE VENDEDOR, por meio de transferência bancária, em até 24 (vinte e quatro) horas após o PROMITENTE COMPRADOR receber os documentos listados na Cláusula Oitava, Item 8.2 (documentos pessoais e do imóvel) deste Contrato. Ultrapassando o prazo de pagamento constante no caput desta cláusula, incidirá a partir do primeiro dia útil subsequente sobre o valor do sinal, multa de 2%, mais mora de 1% (um por cento) ao mês, os quais deverão ser pagos diretamente ao PROMITENTE VENDEDOR independente de interpelação judicial. Ressalte-se que na improvável hipótese de atraso no pagamento da parcela superior a 15 (quinze dias), estará facultado ao PROMITENTE VENDEDOR a rescisão imediata do presente contrato, independentemente de notificação judicial ou extrajudicial com a aplicação das penalidades pertinentes.

R$ 000.000,00 (xxx) em favor do PROMITENTE VENDEDOR, por meio de transferência bancária, no ato da assinatura da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas de Salvador/BA.

3.1 - Tendo como prazo para assinatura da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas de Salvador/BA em até 30 (trinta) dias a partir da apresentação dos documentos elencados no Tópico 8.2.

3.2 - O PROMITENTE COMPRADOR deverá efetuar os pagamentos previstos nesta Cláusula e apresentar os respectivos comprovantes. Esses valores serão somados para ter o preço total da compra e venda (R$000.000,00). Se, por algum motivo, esses valores forem atualizados com juros, multa ou correção, a diferença será repassada ao PROMITENTE VENDEDOR, já com o valor corrigido.

3.3 - No caso de impedimento das obrigações assumidas, quer por motivo de força maior ou caso fortuito, ficam as obrigações prorrogadas à volta da normalidade das atividades necessárias ao cumprimento das obrigações estabelecidas no presente contrato, sem a penalidade de multa e juros.

CLÁUSULA QUARTA- DAS DECLARAÇÕES DO PROMITENTE VENDEDOR

Declara e garante neste ato, PROMITENTE VENDEDOR, que é o legítimo proprietário do imóvel, objeto deste Instrumento Particular de Compra e Venda e, que o citado imóvel, se encontra livre e desembaraçado de quaisquer ônus reais, EXCETO FINANCIAMENTO, bem como de todas e quaisquer medidas legais ou convencionais, quite com todos os impostos, taxas federais, estaduais e municipais, afirmando ainda o PROMITENTE VENDEDOR que a descrição do referido imóvel condiz com a verdade no que se refere à localização, numeração, identificação, áreas limites, confrontações, demais características, não tendo conhecimento da existência de vícios ocultos, e que contra ele, PROMITENTE VENDEDOR, não existem quaisquer dívidas, protestos, ações judiciais em tramitação ou execuções judiciais que possam comprometer a validade e eficácia do presente instrumento, declaração que faz sob pena das responsabilidades legais.

4.1 - Caso o imóvel seja foreiro a qualquer ente, órgão público ou privado, todos os valores de foro, laudêmio e demais encargos incidentes sobre a transferência correrão por conta exclusiva do PROMITENTE VENDEDOR. Caso o imóvel seja terreno próprio e haja cobrança indevida de foro, laudêmio ou encargo semelhante, caberá exclusivamente ao PROMITENTE VENDEDOR promover a regularização, cancelamento e/ou pedido de restituição junto ao órgão competente, arcando com todos os custos e providências necessárias.

4.2 - Ocorrerão por conta exclusiva do PROMITENTE VENDEDOR os honorários de corretagem devidos pelos serviços de intermediação imobiliária prestados, cujo pagamento deverá ser realizado no ato da assinatura da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas, conforme estipulado em contrato de honorários de corretagem firmado com os profissionais abaixo qualificados: SIMONE NASCIMENTO LIMA SOLUÇÕES IMOBILIARIAS LTDA, pessoa jurídica, inscrita regularmente no CRECI-PJ/BA nº 1.617, CNPJ sob nº 17.873.416/0001-17, com sede na Rua dos Colibris, nº79, Edifício Empresarial Paralela Place, Sala 603, Imbuí, Salvador/BA, CEP 41.720-060 e XXXXXX, brasileira, maior, capaz, corretora de imóveis, regularmente inscrita no CRECI-PF/BA 0000, CPF/MF sob nº 0000, residente e domiciliada nesta Capital.

CLÁUSULA QUINTA – DAS DECLARAÇÕES DO PROMITENTE COMPRADOR

O PROMITENTE COMPRADOR declara conhecer e concordar que todos os impostos, taxas, contribuições, bem como, o Imposto de Transmissão Inter Vivos (ITIV), despesas com registro da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas de Salvador/BA, certidões, custo com despachante (opcional), custas cartorárias ou qualquer outra que seja necessária para a efetiva conclusão da presente transação de compra e venda, ocorrerão por conta do PROMITENTE COMPRADOR.

CLÁUSULA SEXTA – DA POSSE

O PROMITENTE VENDEDOR obriga-se perante o PROMITENTE COMPRADOR que efetuará a entrega das chaves com a completa desocupação do bem negociado, no prazo máximo de 00 (XXXX) dias corridos APÓS a quitação do valor total do imóvel (R$ 000.000,00) e assinatura da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas. Podendo por convenção e acordo entre as partes até ser entregue em data anterior. O descumprimento desta cláusula implicará no pagamento de multa diária de R$200,00 (duzentos reais), pagos diretamente ao PROMITENTE COMPRADOR, independente de interpelação judicial.

6.1 - Todos os tributos, impostos, taxas, despesas condominiais, IPTU, contas de consumo e demais encargos incidentes sobre o imóvel, referentes ao período até a entrega das chaves, serão de responsabilidade exclusiva do PROMITENTE VENDEDOR, ainda que sua cobrança, lançamento ou vencimento ocorram posteriormente. A partir da entrega das chaves, todas essas despesas passarão a ser de responsabilidade exclusiva do PROMITENTE COMPRADOR, independentemente da conclusão da transferência de titularidade perante os respectivos órgãos, concessionárias ou administradora do condomínio, obrigando-se a ressarcir a outra parte caso esta arque com obrigação que não lhe competia.

6.1.1 – Até a data da assinatura do contrato de financiamento, o PROMITENTE VENDEDOR deverá quitar integralmente o IPTU do exercício vigente, inclusive antecipando todas as parcelas vincendas, caso esteja parcelado, e apresentar a respectiva Certidão Negativa de Débitos, comprovando a quitação anual e a inexistência de débitos ou parcelamentos. Os débitos de exercícios anteriores permanecerão sob sua exclusiva responsabilidade.

6.2 – Até que seja o PROMITENTE COMPRADOR imitido na posse, responderá o PROMITENTE VENDEDOR pela conservação, vigilância e manutenção do imóvel, ficando sob a responsabilidade do PROMITENTE VENDEDOR manter o imóvel em estado de conservação equivalente ao da data da assinatura deste contrato, sob pena de responsabilidade civil por eventuais danos ou perdas, isentando os corretores de quaisquer responsabilidades.

CLÁUSULA SÉTIMA – DA VISTORIA

O PROMITENTE COMPRADOR declara haver vistoriado o imóvel objeto desta transação, bem como, conferido todas as suas características com as quais concorda expressamente, não tendo o que reclamar no presente ou no futuro, com referência ao citado imóvel, adquirindo-o, portanto, na forma em que se encontra fisicamente. A presente declaração não afasta a responsabilidade do PROMITENTE VENDEDOR por vícios ocultos ou defeitos estruturais não aparentes cuja origem seja comprovadamente anterior à transmissão da posse, bem como por débitos de sua responsabilidade ou por informações relevantes que tenham sido omitidas ou prestadas de forma incorreta.

7.1 - Permanecendo no imóvel: xxxxxxxxx

7.1 - O imóvel será entregue ao PROMITENTE COMPRADOR completamente vazio e desocupado, não permanecendo no local quaisquer bens de propriedade do PROMITENTE VENDEDOR.

CLÁUSULA OITAVA – DAS DISPOSIÇÕES FINAIS

8.1 – Através deste instrumento e na melhor forma do direito, o PROMITENTE VENDEDOR promete vender e os PROMITENTE COMPRADOR promete comprar o imóvel objeto deste Instrumento, excluindo expressamente a hipótese de arrependimento, e, efetivamente o fazem pelo preço e nas condições avençadas no mesmo.

8.1.1 - O presente contrato torna-se válido, perfeito e obrigatório para as partes a partir de sua assinatura, independentemente do pagamento do sinal previsto na alínea "a" da Cláusula Terceira. O sinal previsto na referida alínea não possui natureza de arras confirmatórias ou arras penitenciais, constituindo apenas uma parcela do preço ajustado entre as partes.

8.2 – O PROMITENTE VENDEDOR obriga-se junto ao PROMITENTE COMPRADOR, no prazo máximo de 10 (dez) dias úteis a contar da assinatura deste contrato, a entregar todos os documentos solicitados pertinentes ao imóvel ora negociado, devidamente quitados e atualizados, tais como: Certidão Negativa de Débitos do IPTU, Certidão Negativa de Débitos da COELBA, declaração de condomínio interno e externo com firma reconhecida do síndico, ata do condomínio autenticada, certidão de ônus atualizada (sendo apenas a primeira de sua responsabilidade, observada a regra de responsabilidade prevista nesta cláusula para eventuais renovações), cédula de identidade oficial com foto, comprovante de endereço, certidão de estado civil, certidões de ações judiciais e mais os que se façam necessários à transcrição do mesmo, para a assinatura da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas e posterior registro junto ao cartório. Após 30 (trinta) dias da apresentação de todas as Certidões atualizadas pertinentes ao PROMITENTE VENDEDOR e do IMÓVEL, os custos de atualização da documentação serão suportados pela parte que houver dado causa ao atraso que motivou seu vencimento, exceto a declaração de condomínio com firma reconhecida do síndico e documentos que, porventura, tornem-se inservíveis para o processo de registro junto ao cartório.

8.3 - O PROMITENTE COMPRADOR possui o prazo de 07 (sete) dias corridos após a assinatura da Escritura Pública de Compra e Venda emitida pelo Tabelionato de Notas para a disponibilização do PROTOCOLO DE REGISTRO emitido pelo 0º Ofício de Registro de Imóveis de Salvador/BA. Após esse prazo, o mesmo arcará com a multa de R$20,00 (vinte reais) diários ao PROMITENTE VENDEDOR.

8.3.1 - O PROMITENTE COMPRADOR deverá encaminhar ao PROMITENTE VENDEDOR, em até 5 (cinco) dias úteis após a conclusão do registro, cópia da matrícula atualizada comprovando a transferência da propriedade.

8.4 - Caso haja alguma pendência documental, cadastral ou registral relacionada à presente negociação:

a) Se a pendência for relacionada ao PROMITENTE VENDEDOR e/ou ao IMÓVEL (ex: regularização, certidões negativas, débitos, averbações, Cadastro Imobiliário Brasileiro etc), caberá exclusivamente ao PROMITENTE VENDEDOR resolvê-la.

b) Se a pendência for relacionada ao PROMITENTE COMPRADOR e/ou exigências formuladas pelo Tabelionato de Notas sob sua responsabilidade (ex: reconhecimento de firma, pagamento de ITIV etc), caberá exclusivamente ao PROMITENTE COMPRADOR resolvê-la.

8.4.1 - Quando a pendência for identificada antes da assinatura da Escritura Pública de Compra e Venda, o prazo previsto na Cláusula Terceira, item 3.1, ficará suspenso durante o prazo concedido para regularização da pendência, limitado a 45 (quarenta e cinco) dias corridos. A parte responsável terá esse mesmo prazo para promover a regularização da pendência identificada. Ultrapassado esse prazo, desde que comprovado que a não regularização decorreu exclusivamente de fatores alheios à vontade da parte responsável (demora de cartórios, órgãos públicos, Tabelionato de Notas ou terceiros envolvidos no procedimento), as partes poderão, de comum acordo, celebrar aditivo contratual prorrogando os prazos originalmente pactuados ou rescindir o presente contrato sem aplicação de penalidades.

8.4.2 - Quando a pendência for identificada após a assinatura da Escritura Pública de Compra e Venda e impedir o registro da compra e venda na matrícula do imóvel, a parte responsável terá o prazo máximo de 10 (dez) dias úteis após a notificação por escrito para promover a regularização. Ultrapassado esse prazo sem a devida regularização, sob pena de incidência de multa diária de R$100,00 (cem reais), limitada ao valor máximo de R$3.000,00 (três mil reais), em favor da parte inocente, sem prejuízo das demais responsabilidades previstas neste instrumento.

8.4.3 - As disposições previstas nos itens 8.4.1 e 8.4.2 não se aplicarão quando a não regularização da pendência decorrer, total ou parcialmente, de ato, omissão, negligência, desídia, atraso imputável, falta de colaboração, não apresentação de documentos, não atendimento de exigências formuladas pelo Tabelionato de Notas,Cartório de Registro de Imóveis, órgão competente, ou qualquer outro descumprimento de obrigação atribuída à parte responsável. Nestas hipóteses, aplicar-se-ão integralmente as penalidades, multas, perdas e danos e demais consequências previstas neste contrato, especialmente aquelas constantes da Cláusula Oitava, Item 8.6 e seus subitens.

8.5 – Deverá o PROMITENTE COMPRADOR, sob pena de cobrança de multa compensatória o pagamento diário de R$100,00 (cem reais), em favor do PROMITENTE VENDEDOR, providenciar no prazo máximo de 30 (trinta) dias contados a partir da posse do imóvel, a transferência do nome do proprietário em todas as empresas concessionárias de serviços públicos essenciais, órgãos públicos relativos a questões tributárias próprias do imóvel, como por exemplo: COELBA, IPTU, GÁS, ÁGUA e CONDOMÍNIO.

8.6 – Fica estabelecido que o descumprimento de quaisquer das cláusulas e disposições previstas neste contrato que resulte em sua rescisão por culpa de uma das partes sujeitará a parte infratora ao pagamento de multa compensatória correspondente a 10% (dez por cento) do valor total do contrato, em favor da parte inocente.

a) Se por parte do PROMITENTE VENDEDOR haverá também a devolução do valor que o PROMITENTE COMPRADOR tenha pago, caso tenha sido realizado algum pagamento, no prazo de 72 (setenta e duas) horas contados da formalização do desfazimento do presente negócio.

b) Se por parte do PROMITENTE COMPRADOR, caso tenha sido realizado algum pagamento, o valor da multa descrita acima, em favor do PROMITENTE VENDEDOR, deverá ser deduzido dos valores até então recebidos. Eventual saldo, deverá ser devolvido pelo PROMITENTE VENDEDOR no prazo de 72 (setenta e duas) horas contados da formalização do desfazimento do presente negócio.

8.6.1 – A parte infratora responderá integralmente pelos prejuízos que causar à parte inocente e aos corretores responsáveis pela intermediação da negociação, incluindo despesas judiciais e extrajudiciais, honorários profissionais, comissão de corretagem fixada em 5% (cinco por cento) sobre o valor total do imóvel e demais custos decorrentes do descumprimento contratual.

8.7 – Quaisquer avisos, correspondências, comunicações, convites, notificações ou interpelações entre as partes serão considerados válidos quando realizados por escrito, mediante protocolo, aviso de recebimento (AR), correio eletrônico (e-mail), aplicativo de mensagens eletrônicas, inclusive WhatsApp, ou qualquer outro meio que permita comprovar o envio e o recebimento da comunicação pela outra parte.

8.8 - O presente termo constitui título executivo extrajudicial, nos termos do art. 784, inciso III, do Código de Processo Civil. Em caso de necessidade de execução judicial, o infrator responderá por todas as despesas judiciais, incluindo custas, taxas, emolumentos, bem como honorários advocatícios fixados em 20% (vinte por cento) sobre o valor da dívida.

8.9 - Qualquer alteração do disposto neste instrumento, somente prevalecerá se efetuado por escrito e assinado por quem de direito, não sendo admitida a alegação de precedente ou novação.

8.10 - O presente contrato é celebrado em caráter irretratável e irrevogável, fazendo lei entre as partes, obrigando-se as partes por si e sucessores, vedado o arrependimento e admitida a sua rescisão ou alteração apenas nos casos previstos em lei e neste instrumento desde que ocorra a anuência expressa de seus estipulantes.

8.11 - As partes declaram que tiveram acesso ao presente contrato com antecedência, podendo tirar dúvidas e solicitar alterações, se necessário. A assinatura é realizada de forma livre, sem dolo, ameaça ou coação de qualquer natureza, e com pleno entendimento de todas as cláusulas aqui contidas.

8.12 - As partes reconhecem como válidos, autênticos e eficazes este instrumento e suas assinaturas eletrônicas, inclusive via plataforma CLICKSIGN, nos termos do art. 10, §2º, da MP nº 2.200-2/2001. Renunciam ao direito de questionar sua validade por meio eletrônico e reconhecem o presente como título executivo extrajudicial, passível de execução judicial em caso de descumprimento.

8.13 - E assim por se acharem certos e ajustados, respondendo as partes, herdeiros e/ou sucessores ao seu fiel e exato cumprimento, observando todas as cláusulas e disposições na sua inteireza, às partes elegem o Foro da Cidade de Salvador, Bahia, para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia de qualquer outro, por mais privilegiado que seja, e, assinam o presente instrumento em 03 (três) vias e sem rasuras, na presença das testemunhas, também signatárias deste.

Salvador/BA, ______ de de 2026.

PROMITENTE VENDEDOR

_________________________________________ _________________________________________

XXXXXXXXXX XXXXXXXXXXXXX CPF/MF Nº 000000000000000 CPF/MF N° 000000000

PROMITENTE COMPRADOR

_________________________________________

XXXXXXXX

CPF/MF Nº 000000000

TESTEMUNHAS: _________________________________ _________________________________$modelo$
WHERE NOT EXISTS (SELECT 1 FROM soma.modelos_contrato WHERE nm_modelo = 'Promessa de compra e venda — particular (escritura)');

INSERT INTO soma.modelos_contrato (nm_modelo, ds_descricao, ds_conteudo)
SELECT
  'Promessa de compra e venda — particular (financiamento)',
  'Instrumento particular de promessa de compra e venda para negócio com financiamento bancário e FGTS.',
  $modelo$INSTRUMENTO PARTICULAR DE PROMESSA DE COMPRA E VENDA

Pelo presente instrumento particular e na melhor forma de direito, fazem as partes entre si nomeadas e qualificadas na forma abaixo:

CLÁUSULA PRIMEIRA - DAS PARTES

De um lado, XXXXXX, brasileiro, maior, capaz, profissão, nascido em XXX, natural de XXX, filiação de XXX, portador da cédula de identidade nº 0000 SSP/BA, inscrito no CPF/MF sob nº 0000, casado sob o regime da XXXX com XXXX, brasileira, maior, capaz, profissão, nascida em XXXX, natural de XXX, filiação de XXXX, portadora da cédula de identidade nº 0000 SSP/BA, inscrita no CPF/MF sob nº 0000, ambos residentes e domiciliados na XXXX. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como PROMITENTE VENDEDOR.

De outro lado, XXXX, brasileiro, maior, capaz, profissão, solteiro e declara não conviver em união estável, nascido em 0000, natural de XX, filiação de xxxx, portador da cédula de identidade nº xxx SSP/BA, inscrito no CPF/MF sob nº xxxx, residente e domiciliado na xxxx. Independentemente da quantidade de pessoas que o componham ou do gênero que possuam, adiante assim denominado(s) como PROMITENTE COMPRADOR.

Assim, PROMITENTE VENDEDOR e PROMITENTE COMPRADOR RESOLVEM entre si justos e contratados o seguinte:

CLÁUSULA SEGUNDA - DO IMÓVEL

[DADOS DO IMÓVEL], conforme descrito na matrícula nº XXX do 0º Cartório de Registro de Imóveis de Salvador/BA.

2.1 - Endereço (IPTU): XXXXX

CLÁUSULA TERCEIRA – DO PREÇO E FORMA DE PAGAMENTO

Conforme acordado entre as partes, o PROMITENTE COMPRADOR efetuará o pagamento do imóvel objeto deste Instrumento ao PROMITENTE VENDEDOR, o preço total de R$ 000.000,00 (xxx), por meio de transferência bancária para a conta do BANCO XXX, AGÊNCIA 000, CONTA CORRENTE 00-0 de titularidade do PROMITENTE VENDEDOR, da seguinte forma:

R$ 00.000,00 (xxxx reais) a título de sinal em favor do PROMITENTE VENDEDOR, por meio de transferência bancária, em até 48 (quarenta e oito) horas após a aprovação da engenharia junto ao agente financeiro bancário e apresentação da certidão de ônus atualizada. Ultrapassando o prazo de pagamento constante no caput desta cláusula, incidirá a partir do primeiro dia útil subsequente sobre o valor do sinal, multa de 2%, mais mora de 1% (um por cento) ao mês, os quais deverão ser pagos diretamente ao PROMITENTE VENDEDOR independente de interpelação judicial. Ressalte-se que na improvável hipótese de atraso no pagamento da parcela superior a 15 (quinze dias), estará facultado ao PROMITENTE VENDEDOR a rescisão imediata do presente contrato, independentemente de notificação judicial ou extrajudicial com a aplicação das penalidades pertinentes.

R$ 00.000,00 (xxxx reais) a título de entrada em favor do PROMITENTE VENDEDOR, por meio de transferência bancária, no ato da assinatura do contrato de financiamento.

R$ 00.000,00 (xxxx reais) que será liquidada pelo PROMITENTE COMPRADOR, através de financiamento e FGTS intermediado pelo agente financeiro bancário, valor este que será repassado do banco diretamente ao PROMITENTE VENDEDOR após o registro do contrato de financiamento.

3.1- Na hipótese de, no ato da assinatura do contrato de financiamento, existir valor complementar em recursos próprios para integralizar o preço total da compra e venda (R$000.000,00), o PROMITENTE COMPRADOR deverá quitá-lo de imediato ao PROMITENTE VENDEDOR, mediante transferência bancária ou PIX, a título de entrada.

3.2- Tendo como prazo para assinatura do contrato confeccionado pelo agente financeiro bancário em até 60 (sessenta) dias corridos a partir da presente data.

3.3- No caso de impedimento das obrigações assumidas, quer por motivo de força maior ou caso fortuito, ficam as obrigações prorrogadas à volta da normalidade das atividades necessárias ao cumprimento das obrigações estabelecidas no presente contrato, sem a penalidade de multa e juros.

CLÁUSULA QUARTA- DAS DECLARAÇÕES DO PROMITENTE VENDEDOR

Declara e garante neste ato, PROMITENTE VENDEDOR, que é o legítimo proprietário do imóvel, objeto deste Instrumento Particular de Compra e Venda e, que o citado imóvel, se encontra livre e desembaraçado de quaisquer ônus reais, EXCETO FINANCIAMENTO, bem como de todas e quaisquer medidas legais ou convencionais, quite com todos os impostos, taxas federais, estaduais e municipais, afirmando ainda o PROMITENTE VENDEDOR que a descrição do referido imóvel condiz com a verdade no que se refere à localização, numeração, identificação, áreas limites, confrontações, demais características, não tendo conhecimento da existência de vícios ocultos, e que contra ele, PROMITENTE VENDEDOR, não existem quaisquer dívidas, protestos, ações judiciais em tramitação ou execuções judiciais que possam comprometer a validade e eficácia do presente instrumento, declaração que faz sob pena das responsabilidades legais.

4.1 - Caso o imóvel seja foreiro a qualquer ente, órgão público ou privado, todos os valores de foro, laudêmio e demais encargos incidentes sobre a transferência correrão por conta exclusiva do PROMITENTE VENDEDOR. Caso o imóvel seja terreno próprio e haja cobrança indevida de foro, laudêmio ou encargo semelhante, caberá exclusivamente ao PROMITENTE VENDEDOR promover a regularização, cancelamento e/ou pedido de restituição junto ao órgão competente, arcando com todos os custos e providências necessárias.

4.2 - Ocorrerão por conta exclusiva do PROMITENTE VENDEDOR os honorários de corretagem devidos pelos serviços de intermediação imobiliária prestados, cujo pagamento deverá ser realizado no ato da assinatura do contrato de financiamento, conforme estipulado em contrato de honorários de corretagem firmado com os profissionais abaixo qualificados: SIMONE NASCIMENTO LIMA SOLUÇÕES IMOBILIARIAS LTDA, pessoa jurídica, inscrita regularmente no CRECI-PJ/BA nº 1.617, CNPJ sob nº 17.873.416/0001-17, com sede na Rua dos Colibris, nº79, Edifício Empresarial Paralela Place, Sala 603, Imbuí, Salvador/BA, CEP 41.720-060 e XXXXXX, brasileira, maior, capaz, corretora de imóveis, regularmente inscrita no CRECI-PF/BA 0000, CPF/MF sob nº 0000, residente e domiciliada nesta Capital.

CLÁUSULA QUINTA – DAS DECLARAÇÕES DO PROMITENTE COMPRADOR

O PROMITENTE COMPRADOR declara conhecer e concordar que todos os impostos, taxas, contribuições, bem como, o Imposto de Transmissão Inter Vivos (ITIV), despesas com registro do Contrato de Compra e Venda emitido pelo agente financeiro bancário, certidões, custos com despachante (opcional), custas cartorárias, ou qualquer outra que seja necessária para a efetiva conclusão da presente transação de compra e venda, ocorrerão por conta do PROMITENTE COMPRADOR.

CLÁUSULA SEXTA – DA POSSE

O PROMITENTE VENDEDOR obriga-se perante o PROMITENTE COMPRADOR que efetuará a entrega das chaves com a completa desocupação do bem negociado, no prazo máximo de 00 (XXXX) dias corridos APÓS a quitação do valor total do imóvel (R$ 000.000,00). Podendo por convenção e acordo entre as partes até ser entregue em data anterior. O descumprimento desta cláusula implicará no pagamento de multa diária de R$100,00 (cem reais), pagos diretamente ao PROMITENTE COMPRADOR, independente de interpelação judicial.

6.1 - Todos os tributos, impostos, taxas, despesas condominiais, IPTU, contas de consumo e demais encargos incidentes sobre o imóvel, referentes ao período até a entrega das chaves, serão de responsabilidade exclusiva do PROMITENTE VENDEDOR, ainda que sua cobrança, lançamento ou vencimento ocorram posteriormente. A partir da entrega das chaves, todas essas despesas passarão a ser de responsabilidade exclusiva do PROMITENTE COMPRADOR, independentemente da conclusão da transferência de titularidade perante os respectivos órgãos, concessionárias ou administradora do condomínio, obrigando-se a ressarcir a outra parte caso esta arque com obrigação que não lhe competia.

6.1.1 – Até a data da assinatura do contrato de financiamento, o PROMITENTE VENDEDOR deverá quitar integralmente o IPTU do exercício vigente, inclusive antecipando todas as parcelas vincendas, caso esteja parcelado, e apresentar a respectiva Certidão Negativa de Débitos, comprovando a quitação anual e a inexistência de débitos ou parcelamentos. Os débitos de exercícios anteriores permanecerão sob sua exclusiva responsabilidade.

6.2 – Até que seja o PROMITENTE COMPRADOR imitido na posse, responderá o PROMITENTE VENDEDOR pela conservação, vigilância e manutenção do imóvel, ficando sob a responsabilidade do PROMITENTE VENDEDOR manter o imóvel em estado de conservação equivalente ao da data da assinatura deste contrato, sob pena de responsabilidade civil por eventuais danos ou perdas, isentando os corretores de quaisquer responsabilidades.

CLÁUSULA SÉTIMA – DA VISTORIA

O PROMITENTE COMPRADOR declara haver vistoriado o imóvel objeto desta transação, bem como, conferido todas as suas características com as quais concorda expressamente, não tendo o que reclamar no presente ou no futuro, com referência ao citado imóvel, adquirindo-o, portanto, na forma em que se encontra fisicamente. A presente declaração não afasta a responsabilidade do PROMITENTE VENDEDOR por vícios ocultos ou defeitos estruturais não aparentes cuja origem seja comprovadamente anterior à transmissão da posse, bem como por débitos de sua responsabilidade ou por informações relevantes que tenham sido omitidas ou prestadas de forma incorreta.

7.1 - Permanecendo no imóvel: xxxxxxxxx

7.1 - O imóvel será entregue ao PROMITENTE COMPRADOR completamente vazio e desocupado, não permanecendo no local quaisquer bens de propriedade do PROMITENTE VENDEDOR.

CLÁUSULA OITAVA – DAS DISPOSIÇÕES FINAIS

8.1 – Através deste instrumento e na melhor forma do direito, o PROMITENTE VENDEDOR promete vender e os PROMITENTE COMPRADOR promete comprar o imóvel objeto deste Instrumento, excluindo expressamente a hipótese de arrependimento, e, efetivamente o fazem pelo preço e nas condições avençadas no mesmo.

8.1.1 - O presente contrato torna-se válido, perfeito e obrigatório para as partes a partir de sua assinatura, independentemente da realização de qualquer pagamento previsto neste instrumento. O sinal previsto acima na Cláusula Terceira, alínea “a” não possui natureza de arras confirmatórias ou arras penitenciais, constituindo apenas uma parcela do preço ajustado entre as partes.

8.2 – O PROMITENTE VENDEDOR obriga-se junto ao PROMITENTE COMPRADOR, no prazo máximo de 10 (dez) dias úteis a contar da assinatura deste contrato, a entregar todos os documentos solicitados pertinentes ao imóvel ora negociado, devidamente quitados e atualizados, tais como: Certidão Negativa de Débitos do IPTU, Certidão Negativa de Débitos da COELBA, declaração de condomínio interno e externo com firma reconhecida do síndico, ata do condomínio autenticada, certidão de ônus atualizada (sendo apenas a primeira de sua responsabilidade, observada a regra de responsabilidade prevista nesta cláusula para eventuais renovações), cédula de identidade oficial com foto, comprovante de endereço, certidão de estado civil, certidões de ações judiciais e mais os que se façam necessários à transcrição do mesmo, para a assinatura do Contrato de Financiamento emitido pela instituição bancária e posterior registro junto ao cartório. Após 30 (trinta) dias da apresentação de todas as Certidões atualizadas pertinentes ao PROMITENTE VENDEDOR e do IMÓVEL, os custos de atualização da documentação serão suportados pela parte que houver dado causa ao atraso que motivou seu vencimento, exceto a declaração de condomínio com firma reconhecida do síndico e documentos que, porventura, tornem-se inservíveis para o processo de registro junto ao cartório.

8.3 - O PROMITENTE COMPRADOR possui o prazo de 07 (sete) dias corridos após a assinatura do Contrato de Financiamento emitido pela instituição bancária para a disponibilização do PROTOCOLO DE REGISTRO emitido pelo 0º Ofício de Registro de Imóveis de Salvador/BA. Após esse prazo, o mesmo arcará com a multa de R$20,00 (vinte reais) diários ao PROMITENTE VENDEDOR.

8.4 - Caso haja alguma pendência documental, cadastral ou registral relacionada à presente negociação:

a) Se a pendência for relacionada ao PROMITENTE VENDEDOR e/ou ao IMÓVEL (ex: regularização, certidões negativas, débitos, averbações, Cadastro Imobiliário Brasileiro etc), caberá exclusivamente ao PROMITENTE VENDEDOR resolvê-la.

b) Se a pendência for relacionada ao PROMITENTE COMPRADOR e/ou exigências formuladas pela instituição financeira sob sua responsabilidade (ex: reconhecimento de firma do gerente, comprovação de renda, pagamento de ITIV etc), caberá exclusivamente ao PROMITENTE COMPRADOR resolvê-la.

8.4.1 - Quando a pendência for identificada antes da assinatura do contrato de financiamento, o prazo previsto na Cláusula Terceira, item 3.2, ficará suspenso durante o prazo concedido para regularização da pendência, limitado a 45 (quarenta e cinco) dias corridos. A parte responsável terá esse mesmo prazo para promover a regularização da pendência identificada. Ultrapassado esse prazo, desde que comprovado que a não regularização decorreu exclusivamente de fatores alheios à vontade da parte responsável (demora de cartórios, órgãos públicos, instituições financeiras ou terceiros envolvidos no procedimento), as partes poderão, de comum acordo, celebrar aditivo contratual prorrogando os prazos originalmente pactuados ou rescindir o presente contrato sem aplicação de penalidades.

8.4.2 - Quando a pendência for identificada após a assinatura do contrato de financiamento e impedir o registro da compra e venda na matrícula do imóvel, a parte responsável terá o prazo máximo de 10 (dez) dias úteis após a notificação por escrito para promover a regularização. Ultrapassado esse prazo sem a devida regularização, sob pena de incidência de multa diária de R$100,00 (cem reais), limitada ao valor máximo de R$3.000,00 (três mil reais), em favor da parte inocente, sem prejuízo das demais responsabilidades previstas neste instrumento.

8.4.3 - As disposições previstas nos itens 8.4.1 e 8.4.2 não se aplicarão quando a não regularização da pendência decorrer, total ou parcialmente, de ato, omissão, negligência, desídia, atraso imputável, falta de colaboração, não apresentação de documentos, não atendimento de exigências formuladas pela instituição financeira, cartório ou órgão competente, ou qualquer outro descumprimento de obrigação atribuída à parte responsável. Nestas hipóteses, aplicar-se-ão integralmente as penalidades, multas, perdas e danos e demais consequências previstas neste contrato, especialmente aquelas constantes da Cláusula Oitava, Item 8.7 e seus subitens.

8.5 – Deverá o PROMITENTE COMPRADOR, sob pena de cobrança de multa compensatória o pagamento diário de R$100,00 (cem reais), em favor do PROMITENTE VENDEDOR, providenciar no prazo máximo de 30 (trinta) dias contados a partir da posse do imóvel, a transferência do nome do proprietário em todas as empresas concessionárias de serviços públicos essenciais, órgãos públicos relativos a questões tributárias próprias do imóvel, como por exemplo: COELBA, IPTU, GÁS, ÁGUA e CONDOMÍNIO.

8.6 - Havendo qualquer impedimento por motivo alheio à vontade das partes e proveniente da instituição financeira, tais como negativa de crédito, reprovação do imóvel pela engenharia, inviabilidade da operação de financiamento ou qualquer outro fato que impeça a conclusão da negociação sem que haja culpa do PROMITENTE VENDEDOR ou do PROMITENTE COMPRADOR, o presente contrato poderá ser rescindido sem aplicação de penalidades para quaisquer das partes. Caso tenha sido realizado algum pagamento de sinal e/ou entrada ao PROMITENTE VENDEDOR, os valores recebidos deverão ser integralmente devolvidos ao PROMITENTE COMPRADOR no prazo de até 72 (setenta e duas) horas contadas da formalização do desfazimento do negócio. A notificação de rescisão deverá ser acompanhada da documentação que comprove a impossibilidade de conclusão da operação de financiamento. O descumprimento do prazo de restituição implicará incidência de multa de 2% (dois por cento) sobre o valor devido, acrescida de correção monetária pelo IPCA e juros de mora de 1% (um por cento) ao mês, calculados pro rata die até a data do efetivo pagamento.

8.7 – Fica estabelecido que o descumprimento de quaisquer das cláusulas e disposições previstas neste contrato que resulte em sua rescisão por culpa de uma das partes sujeitará a parte infratora ao pagamento de multa compensatória correspondente a 10% (dez por cento) do valor total do contrato, em favor da parte inocente.

a) Se por parte do PROMITENTE VENDEDOR haverá também a devolução do valor que o PROMITENTE COMPRADOR tenha pago, caso tenha sido realizado algum pagamento, no prazo de 72 (setenta e duas) horas contados da formalização do desfazimento do presente negócio.

b) Se por parte do PROMITENTE COMPRADOR, caso tenha sido realizado algum pagamento, o valor da multa descrita acima, em favor do PROMITENTE VENDEDOR, deverá ser deduzido dos valores até então recebidos. Eventual saldo, deverá ser devolvido pelo PROMITENTE VENDEDOR no prazo de 72 (setenta e duas) horas contados da formalização do desfazimento do presente negócio.

8.7.1 – A parte infratora responderá integralmente pelos prejuízos que causar à parte inocente e aos corretores responsáveis pela intermediação da negociação, incluindo despesas judiciais e extrajudiciais, honorários profissionais, comissão de corretagem fixada em 5% (cinco por cento) sobre o valor total do imóvel e demais custos decorrentes do descumprimento contratual.

8.8 – Quaisquer avisos, correspondências, comunicações, convites, notificações ou interpelações entre as partes serão considerados válidos quando realizados por escrito, mediante protocolo, aviso de recebimento (AR), correio eletrônico (e-mail), aplicativo de mensagens eletrônicas, inclusive WhatsApp, ou qualquer outro meio que permita comprovar o envio e o recebimento da comunicação pela outra parte.

8.9 - O presente termo constitui título executivo extrajudicial, nos termos do art. 784, inciso III, do Código de Processo Civil. Em caso de necessidade de execução judicial, o infrator responderá por todas as despesas judiciais, incluindo custas, taxas, emolumentos, bem como honorários advocatícios fixados em 20% (vinte por cento) sobre o valor da dívida.

8.10 - Qualquer alteração do disposto neste instrumento, somente prevalecerá se efetuado por escrito e assinado por quem de direito, não sendo admitida a alegação de precedente ou novação.

8.11 - O presente contrato é celebrado em caráter irretratável e irrevogável, fazendo lei entre as partes, obrigando-se as partes por si e sucessores, vedado o arrependimento e admitida a sua rescisão ou alteração apenas nos casos previstos em lei e neste instrumento desde que ocorra a anuência expressa de seus estipulantes.

8.12 - As partes declaram que tiveram acesso ao presente contrato com antecedência, podendo tirar dúvidas e solicitar alterações, se necessário. A assinatura é realizada de forma livre, sem dolo, ameaça ou coação de qualquer natureza, e com pleno entendimento de todas as cláusulas aqui contidas.

8.13 - As partes reconhecem como válidos, autênticos e eficazes este instrumento e suas assinaturas eletrônicas, inclusive via plataforma CLICKSIGN, nos termos do art. 10, §2º, da MP nº 2.200-2/2001. Renunciam ao direito de questionar sua validade por meio eletrônico e reconhecem o presente como título executivo extrajudicial, passível de execução judicial em caso de descumprimento.

8.14 - E assim por se acharem certos e ajustados, respondendo as partes, herdeiros e/ou sucessores ao seu fiel e exato cumprimento, observando todas as cláusulas e disposições na sua inteireza, às partes elegem o Foro da Cidade de Salvador, Bahia, como competente para esclarecimentos de dúvidas ou controvérsias, e, assinam o presente instrumento em 03 (três) vias e sem rasuras, na presença das testemunhas, também signatárias deste.

Salvador/BA, ______ de de 2026.

PROMITENTE VENDEDOR

_________________________________________ _________________________________________

XXXXXXXXXX XXXXXXXXXXXXX CPF/MF Nº 000000000000000 CPF/MF N° 000000000

PROMITENTE COMPRADOR

_________________________________________

XXXXXXXX

CPF/MF Nº 000000000

TESTEMUNHAS: _________________________________ _________________________________$modelo$
WHERE NOT EXISTS (SELECT 1 FROM soma.modelos_contrato WHERE nm_modelo = 'Promessa de compra e venda — particular (financiamento)');

INSERT INTO soma.modelos_contrato (nm_modelo, ds_descricao, ds_conteudo)
SELECT
  'Laudo de vistoria — locação residencial',
  'Termo de vistoria que integra o contrato de locação residencial: estado geral do imóvel, descrição dos ambientes e responsabilidades na devolução.',
  $modelo$LAUDO DE VISTORIA

LOCADOR: XXXXXX, brasileiro, maior, capaz, profissão, nascido em 000, filiação de XXXXX, portador da cédula de identidade nº 000 SSP/BA, inscrito no CPF/MF sob nº 0000, casado sob o regime da comunhão parcial de bens com XXXXX, brasileira, maior, capaz, profissão, nascida em 0000, filiação de xxxx, portadora da cédula de identidade nº 000 SSP/BA, inscrita no CPF/MF sob nº 0000, ambos residentes e domiciliados ENDEREÇO.

LOCATÁRIO: XXXXXX, brasileiro, maior, capaz, profissão, nascido em 000, filiação de XXXXX, portador da cédula de identidade nº 000 SSP/BA, inscrito no CPF/MF sob nº 0000, casado sob o regime da comunhão parcial de bens com XXXXX, brasileira, maior, capaz, profissão, nascida em 0000, filiação de xxxx, portadora da cédula de identidade nº 000 SSP/BA, inscrita no CPF/MF sob nº 0000, ambos residentes e domiciliados ENDEREÇO.

IMÓVEL: (Endereço IPTU) XXXXXXX

Resolvem firmar o presente TERMO DE VISTORIA, que passa a integrar o Contrato de Locação de Imóvel Residencial celebrado entre as partes.

CLÁUSULA PRIMEIRA: ESTADO GERAL DO IMÓVEL

1.1 - Estado geral: Pisos, paredes, tetos, portas, esquadrias, pintura e demais elementos construtivos encontram-se em bom estado de conservação.

1.2 - Instalações elétricas: Tomadas, interruptores, bocais, luminárias e demais pontos elétricos encontram-se em bom estado de conservação e funcionamento.

1.3 - Instalações hidráulicas e sanitárias: Fornecimento de água regular no momento da vistoria. As instalações hidráulicas e sanitárias encontram-se em bom estado de conservação e funcionamento, sem irregularidades constatadas durante a inspeção.

1.4 - Instalações diversas: Esquadrias, vidros, portas e demais elementos permanentes encontram-se em bom estado de conservação e funcionamento.

CLÁUSULA SEGUNDA: DESCRIÇÃO DETALHADA DOS AMBIENTES

2.1 - VARANDA/ENTRADA: em bom estado geral de uso e conservação.

a) Piso: revestido em cerâmica em tons avermelhados/terracota, com aspecto rústico, apresentando desgaste natural de uso,

marcas aparentes e variações visuais compatíveis com o tempo de utilização.

b) Paredes: em alvenaria com pintura lisa branca, em bom estado aparente, contendo pequenas marcas e imperfeições visuais

compatíveis com o uso normal do imóvel.

c) Porta de acesso: 01 (uma) porta em madeira escura, tipo correr, com detalhes em vidro texturizado/translúcido, em aparente

bom estado de conservação e funcionamento.

d) Janela: 01 (uma) janela em madeira escura, tipo abrir, com partes superiores em vidro texturizado/translúcido, em aparente

bom estado visual.

e) Contém: 04 (quatro) cadeiras/poltronas rústicas em madeira; soleira de acesso em pedra; e tapete simples azul junto à

entrada. f) Observação: As cadeiras em madeira apresentam desgaste natural decorrente do tempo e exposição ao ambiente, compatível com o estado geral do imóvel e das fotografias anexas.

(FOTOS)

2.2 - VARANDA/ENTRADA: em bom estado geral de uso e conservação.

a) Piso: …..

b) Paredes: ….

c) Porta de acesso: …..

d) Janela: …..

e) Contém: ….. f) Observação: …..

(FOTOS)

CLÁUSULA TERCEIRA - O presente instrumento é parte integrante do Contrato de Locação firmado entre as partes contratantes, e o LOCATÁRIO se responsabiliza integralmente pela conservação e segurança do imóvel, bem como de seu mobiliário e utensílios, arcando com qualquer prejuízo causado por perdas e danos constatados na ocasião da devolução do bem, ressalvadas as deteriorações naturais decorrentes do uso normal. As avarias pré-existentes, devidamente registradas neste laudo ou em imagens anexas, serão

de responsabilidade exclusiva do LOCADOR. Em caso de vícios ou avarias não identificados neste termo, mas constatados pelo

LOCATÁRIO em até 7 (sete) dias após o recebimento das chaves, deverá o LOCATÁRIO comunicar formalmente ao LOCADOR.

CLÁUSULA QUARTA - Caso sejam acrescentados móveis ou feitas melhorias no imóvel durante a locação, o LOCADOR e o

LOCATÁRIO deverão registrar esse acréscimo por escrito, com a descrição do que foi incluído e a data da entrega. As melhorias necessárias feitas pelo LOCATÁRIO, desde que autorizadas pelo LOCADOR, poderão ser reembolsadas. Já as melhorias apenas para embelezar ou facilitar o uso (voluptuárias ou úteis) só poderão ser retiradas pelo LOCATÁRIO ao final do contrato se isso não causar danos ao imóvel, salvo se as partes fizerem outro acordo por escrito.

CLÁUSULA QUINTA - O imóvel acima descrito deverá ser entregue pelo LOCATÁRIO ao LOCADOR nas mesmas condições em que o recebeu (COM pintura), conforme descrito e documentado neste laudo, incluindo pertences e móveis, mesmo que estes tenham sido entregues após o início da LOCAÇÃO, ressalvado o desgaste natural pelo uso normal.

CLÁUSULA SEXTA - Fica registrado que integram o presente Laudo de Vistoria as imagens fotográficas anexadas, que retratam fielmente o estado de conservação, os móveis, equipamentos e utensílios existentes no imóvel. Fica ainda pactuado que todos os itens constantes nas fotografias, mesmo que não descritos detalhadamente neste laudo, permanecem como parte integrante do imóvel locado e deverão ser restituídos pelo LOCATÁRIO ao término da locação, nas mesmas condições em que foram recebidos, ressalvado o desgaste natural pelo uso regular.

CLÁUSULA SÉTIMA - Fica expressamente estabelecido que qualquer alteração, modificação, benfeitoria ou intervenção no imóvel, ainda que de natureza estética ou funcional, somente poderá ser realizada mediante autorização prévia e expressa do LOCADOR, por escrito. As alterações realizadas sem autorização poderão ensejar a obrigação de restauração do imóvel ao estado original, às expensas do LOCATÁRIO, sem prejuízo de eventuais perdas e danos.

Por estarem justos e contratados, e de pleno acordo com o disposto neste instrumento, assinam o presente em 02 (duas) vias de igual teor e forma, na presença de duas testemunhas, para que se produza o efeito legal.

Salvador (BA), de de 2026.

LOCADOR ______________________________________________ NOME CPF/MF N° 0000000

LOCATÁRIO

______________________________________________ NOME CPF/MF N° 0000000

TESTEMUNHAS:

_________________________________ _________________________________$modelo$
WHERE NOT EXISTS (SELECT 1 FROM soma.modelos_contrato WHERE nm_modelo = 'Laudo de vistoria — locação residencial');

