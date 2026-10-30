export type RoleUsuario =
  | "master"
  | "juridico"
  | "imobiliaria"
  | "despachante"
  | "corretor"
  | "gerente"
  | "vendedor"
  | "comprador"
  | "outro_cliente";

// Seções do menu lateral — o que cada perfil pode acessar é
// configurável em Configurações > Perfil de acesso (ver migration
// 027), Master sempre tem acesso a tudo (hardcoded, nunca passa por
// essa tabela) pra nunca se trancar fora da própria tela que
// configuraria isso.
export type SecaoAcesso =
  | "dashboard"
  | "orcamentos"
  | "processos"
  | "servicos"
  | "boletos"
  | "usuarios"
  | "configuracoes"
  | "kpis";

export const SECAO_ACESSO_LABEL: Record<SecaoAcesso, string> = {
  dashboard: "Início",
  orcamentos: "Orçamentos",
  processos: "Processos",
  servicos: "Serviços",
  boletos: "Taxas e Emolumentos",
  usuarios: "Usuários",
  configuracoes: "Configurações",
  kpis: "Indicadores",
};

export const SECOES_ACESSO: SecaoAcesso[] = [
  "dashboard",
  "orcamentos",
  "processos",
  "servicos",
  "boletos",
  "usuarios",
  "configuracoes",
  "kpis",
];

// As 5 seções com CRUD de verdade — Início e Configurações ficam de
// fora, só têm liga/desliga (sn_ver). Ver migration 032.
export const SECOES_COM_CRUD: SecaoAcesso[] = [
  "orcamentos",
  "processos",
  "usuarios",
  "servicos",
  "boletos",
];

export type AcaoPermissao = "ver" | "criar" | "editar" | "excluir";

export type TipoOperacaoAuditoria = "INSERT" | "UPDATE" | "DELETE";

// Log genérico de qualquer INSERT/UPDATE/DELETE nas tabelas
// auditadas — ver migration 033. dados_antigos/dados_novos guardam a
// linha inteira em JSON (a que muda depende de tp_operacao).
export interface LogAuditoria {
  cd_log: string;
  cd_usuario: string | null;
  nm_tabela: string;
  tp_operacao: TipoOperacaoAuditoria;
  cd_registro: string | null;
  dados_antigos: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  ts_criacao: string;
}

export interface PerfilAcesso {
  tp_role: RoleUsuario;
  cd_secao: SecaoAcesso;
  sn_ver: boolean;
  sn_criar: boolean;
  sn_editar: boolean;
  sn_excluir: boolean;
}

// Única escolha fixa no início da criação do orçamento — nunca mistura
// itens dos dois tipos no mesmo orçamento/processo (ver migration 014).
export type TipoProcesso = "despachante" | "contrato";

export type StatusOrcamento = "pendente" | "aceito" | "pago" | "liberado" | "reprovado";

export type TipoServico = "honorario" | "custa";

export type PerfilDocumento = "comprador" | "vendedor" | "imovel" | "outro";

export type StatusDocumento = "pendente" | "validado" | "rejeitado";

export type StatusPendencia = "aberta" | "concluida" | "atrasada";

export interface Usuario {
  cd_usuario: string;
  nm_usuario: string;
  ds_email: string;
  ds_telefone: string | null;
  tp_role: RoleUsuario;
  cd_imobiliaria: string | null;
  sn_ativo: boolean;
  // Freio anti-spam de /esqueci-senha — ver migration 030.
  ts_ultima_recuperacao_senha: string | null;
  ts_criacao: string;
}

export interface Imobiliaria {
  cd_imobiliaria: string;
  nm_imobiliaria: string;
  ds_cnpj: string | null;
  ds_telefone: string | null;
  ds_email: string | null;
  // Qualificação no contrato (migration 057).
  ds_creci: string | null;
  ds_endereco: string | null;
  sn_ativo: boolean;
  ts_criacao: string;
}

export type LocalServico =
  | "CRI"
  | "NOTAS"
  | "RCPN"
  | "SEFAZ"
  | "SEDUR"
  | "RF"
  | "TJ"
  | "TRT"
  | "TRF"
  | "SOMA"
  | "CONTRATO";

export interface Servico {
  cd_servico: string;
  cd_codigo: string | null;
  tp_local: LocalServico | null;
  nm_categoria: string | null;
  nm_servico: string;
  ds_descricao: string | null;
  ds_checklist: string | null;
  tp_servico: TipoServico;
  sn_valor_variavel: boolean;
  sn_ativo: boolean;
  ts_criacao: string;
  ts_atualizacao: string;
}

export interface ServicoPreco {
  cd_servico_preco: string;
  cd_servico: string;
  nm_cidade: string;
  vl_valor: number;
}

export type ServicoComPrecos = Servico & { servico_precos: ServicoPreco[] };

// Fallback só pra quando a migration 019 (soma.cidades) ainda não
// rodou — a lista de verdade agora é cadastrável em Configurações >
// Cidades e cada tela busca do banco (ver CidadeRow/actions).
export const CIDADES_SERVICO_PADRAO = ["Salvador", "Lauro de Freitas", "Camaçari"];

export interface Cidade {
  cd_cidade: string;
  nm_cidade: string;
  sn_ativo: boolean;
  nr_ordem: number;
}

export const LOCAL_SERVICO_LABEL: Record<LocalServico, string> = {
  CRI: "Cartório de Registro de Imóveis",
  NOTAS: "Tabelionato de Notas",
  RCPN: "Registro Civil de Pessoas Naturais",
  SEFAZ: "SEFAZ / Prefeitura (IPTU, ITIV)",
  SEDUR: "SEDUR",
  RF: "Receita Federal",
  TJ: "Tribunal de Justiça",
  TRT: "Tribunal Regional do Trabalho",
  TRF: "Tribunal Regional Federal",
  SOMA: "Serviços SOMA",
  CONTRATO: "Contrato Imobiliário",
};

// Ordem de exibição das abas — do mais usado ao mais raro.
export const LOCAIS_SERVICO: LocalServico[] = [
  "CRI",
  "NOTAS",
  "RCPN",
  "SEFAZ",
  "SEDUR",
  "SOMA",
  "CONTRATO",
  "RF",
  "TJ",
  "TRT",
  "TRF",
];

// Só os órgãos do catálogo de Despachante — usado pra filtrar o
// combobox de serviços quando o orçamento é do tipo "despachante"
// (exclui CONTRATO, que é um tipo de orçamento à parte).
export const LOCAIS_DESPACHANTE: LocalServico[] = LOCAIS_SERVICO.filter(
  (local) => local !== "CONTRATO"
);

export interface Processo {
  cd_processo: string;
  ds_numero_processo: string;
  tp_processo: TipoProcesso;
  cd_imobiliaria: string | null;
  cd_comprador: string | null;
  cd_vendedor: string | null;
  cd_corretor: string | null;
  cd_despachante: string | null;
  ds_observacoes_juridicas: string | null;
  nm_comprador_convidado: string | null;
  ds_telefone_comprador_convidado: string | null;
  tp_etapa_contrato: TipoEtapaContrato | null;
  ts_criacao: string;
  ts_atualizacao: string;
}

// --- Dados do negócio capturados na abertura (migration 048) --------

// Papéis possíveis de uma parte do processo (migration 051). O
// checklist fixo de documentos só existe pra vendedor/comprador; os
// outros papéis anexam documento avulso.
export type LadoParte =
  | "vendedor"
  | "comprador"
  | "corretor"
  | "imobiliaria"
  | "adm"
  | "cliente";

export const LADO_PARTE_LABEL: Record<LadoParte, string> = {
  vendedor: "Vendedor",
  comprador: "Comprador",
  corretor: "Corretor",
  imobiliaria: "Imobiliária",
  adm: "Administrador",
  cliente: "Cliente",
};

// Papéis que têm checklist fixo de documentos.
export const LADOS_COM_CHECKLIST: LadoParte[] = ["vendedor", "comprador"];

// Categorias do checklist de documentos do intake (migration 049). O
// status é derivado: anexou (existe soma.documentos com essa categoria
// para a parte) = OK; não anexou = Falta.
// Cada item aceita mais de um arquivo (ex: frente e verso).
export type CategoriaDocIntake =
  | "identidade"
  | "estado_civil"
  | "comprovante_residencia"
  | "uniao_estavel"
  | "onus_escritura"
  | "iptu"
  | "contrato_social"
  | "certidoes";

export const CATEGORIA_DOC_INTAKE_LABEL: Record<CategoriaDocIntake, string> = {
  identidade: "Identidade ou CNH",
  estado_civil: "Certidão de estado civil",
  comprovante_residencia: "Comprovante de residência",
  uniao_estavel: "Declaração de união estável",
  onus_escritura: "Certidão de ônus ou Escritura",
  iptu: "IPTU do imóvel",
  contrato_social: "Contrato social / certidão da Junta",
  certidoes: "Certidões (negativas, fiscais, forenses)",
};

// Documentos pessoais de vendedor e comprador. O checklist exato de
// cada pessoa depende do vínculo com o par (ver lib/checklist-partes).
export const CATEGORIAS_DOC_PESSOAIS: CategoriaDocIntake[] = [
  "identidade",
  "estado_civil",
  "comprovante_residencia",
];

// Documentos da empresa (vendedor/comprador com CNPJ).
export const CATEGORIAS_DOC_EMPRESA: CategoriaDocIntake[] = ["contrato_social", "certidoes"];

// Documentos do imóvel — um conjunto por processo (migration 057),
// não um por vendedor.
export const CATEGORIAS_DOC_IMOVEL: CategoriaDocIntake[] = ["onus_escritura", "iptu"];

// Vínculo da 2ª pessoa em diante com a pessoa anterior do mesmo lado.
export type VinculoParte = "conjuge" | "companheiro" | "anuente" | "representante" | "outro";

export const VINCULO_PARTE_LABEL: Record<VinculoParte, string> = {
  conjuge: "Cônjuge (casados)",
  companheiro: "Companheiro(a) — união estável",
  anuente: "Anuente (consente no negócio)",
  representante: "Representante (assina pela empresa)",
  outro: "Outra pessoa",
};

// Cartórios de registro de imóveis atendidos (código salvo no banco).
export const CARTORIOS_IMOVEIS: { codigo: string; rotulo: string }[] = [
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ codigo: `salvador-${n}`, rotulo: `Salvador — ${n}º Ofício` })),
  { codigo: "lauro-de-freitas-1", rotulo: "Lauro de Freitas — 1º Ofício" },
  { codigo: "camacari-1", rotulo: "Camaçari — 1º Ofício" },
  { codigo: "camacari-2", rotulo: "Camaçari — 2º Ofício" },
];

export type FormaPagamento = "financiado" | "a_vista";

export interface ProcessoNegocio {
  cd_processo: string;
  vl_imovel: number | null;
  vl_entrada: number | null;
  vl_financiamento: number | null;
  ds_banco: string | null;
  sn_possui_inquilino: boolean | null;
  sn_ocupado: boolean | null;
  ds_entrega_chaves: string | null;
  ds_itens_imovel: string | null;
  // Imóvel com financiamento/hipoteca em aberto (lido da matrícula por IA); null = não se sabe.
  sn_imovel_financiado: boolean | null;
  // Prazo p/ assinar o financiamento (cláusula 3.2); null = padrão "60 (sessenta) dias corridos".
  ds_prazo_financiamento: string | null;
  ds_imovel_endereco: string | null;
  ds_imovel_matricula: string | null;
  ds_imovel_iptu: string | null;
  ds_imovel_descricao: string | null;
  ds_imovel_cartorio: string | null;
  tp_pagamento: FormaPagamento | null;
  vl_sinal: number | null;
  sn_usa_fgts: boolean | null;
  vl_fgts: number | null;
  vl_saldo_quitacao: number | null;
  vl_honorarios_total: number | null;
  // % do valor do imóvel
  pc_honorarios_total: number | null;
  ds_honorarios_quando: string | null;
  vl_honorarios_imobiliaria: number | null;
  // % do total dos honorários
  pc_honorarios_imobiliaria: number | null;
  ts_atualizacao: string;
}

export interface ProcessoParte {
  cd_parte: string;
  cd_processo: string;
  tp_lado: LadoParte;
  nr_ordem: number;
  nm_parte: string;
  ds_telefone: string | null;
  ds_email: string | null;
  ds_profissao: string | null;
  ds_conta_bancaria: string | null;
  ds_documentos_obs: string | null;
  ds_cpf: string | null;
  ds_rg: string | null;
  dt_nascimento: string | null;
  ds_endereco: string | null;
  tp_vinculo: VinculoParte | null;
  // Resposta do cliente no link: vive em união estável? (null = não respondeu; migration 072)
  sn_uniao_estavel: boolean | null;
  // Casado(a), união estável ou sem vínculo, respondido no link (migration 074)
  ds_situacao_conjugal: "casado" | "uniao_estavel" | "sem_vinculo" | null;
  // Empresa (CNPJ no campo ds_cpf)
  ds_nire: string | null;
  ds_tipo_societario: string | null;
  ds_representacao: "conjunta" | "isolada" | null;
  // Link público de autoatendimento da parte (migration 050).
  cd_token_parte: string | null;
}

// Retorno de soma.fn_parte_por_token — tela pública /parte/[token].
export interface ParteAutoatendimento {
  // null enquanto é só um convite (link gerado antes de o processo existir)
  cd_parte: string | null;
  cd_processo: string | null;
  tp_lado: LadoParte;
  nm_parte: string;
  ds_telefone: string | null;
  ds_email: string | null;
  ds_profissao: string | null;
  ds_conta_bancaria: string | null;
  ds_cpf: string | null;
  ds_rg: string | null;
  dt_nascimento: string | null;
  ds_endereco: string | null;
  sn_uniao_estavel: boolean | null;
  ds_situacao_conjugal?: "casado" | "uniao_estavel" | "sem_vinculo" | null;
  ds_numero_processo: string | null;
  documentos: {
    cd_documento: string;
    tp_categoria_intake: CategoriaDocIntake | null;
    nm_arquivo: string;
  }[];
  // Cônjuge/companheiro(a) — documentos compartilhados do casal.
  parceiro: {
    nm_parte: string;
    tp_vinculo: "conjuge" | "companheiro";
    documentos: { tp_categoria_intake: CategoriaDocIntake; nm_arquivo: string }[];
  } | null;
  // Só pro vendedor: documentos do imóvel (um conjunto por processo).
  documentos_imovel:
    | {
        cd_documento: string;
        tp_categoria_intake: CategoriaDocIntake;
        nm_arquivo: string;
        sn_meu: boolean;
      }[]
    | null;
}

export interface ProcessoCorretor {
  cd_processo_corretor: string;
  cd_processo: string;
  cd_corretor: string | null;
  nm_corretor: string;
  vl_honorario: number | null;
  // % do total dos honorários
  pc_honorario: number | null;
  ds_lado: string | null;
  nr_ordem: number;
}

// Cadastro de corretores (migration 056) — corretor digitado nos
// honorários de um processo entra aqui automaticamente.
export interface Corretor {
  cd_corretor: string;
  nm_corretor: string;
  ds_cpf: string | null;
  ds_creci: string | null;
  ds_telefone: string | null;
  ds_email: string | null;
  ds_pix: string | null;
  ds_conta_bancaria: string | null;
  dt_nascimento: string | null;
  sn_ativo: boolean;
  ts_criacao: string;
}

// Etapa do fluxo de contrato — só existe (não-null) quando
// tp_processo = "contrato". Orçamento do Despachante entra em
// paralelo a essa esteira, sem depender dela.
export type TipoEtapaContrato =
  | "documentacao"
  | "minuta_pendente"
  | "minuta_reprovada"
  | "aguardando_assinatura"
  | "concluido";

export const ETAPA_CONTRATO_LABEL: Record<TipoEtapaContrato, string> = {
  documentacao: "Documentação em análise",
  minuta_pendente: "Minuta em aprovação",
  minuta_reprovada: "Minuta reprovada",
  aguardando_assinatura: "Aguardando assinatura",
  concluido: "Concluído",
};

// As 5 frentes que precisam aprovar a minuta antes do contrato final.
export type TipoPapelAprovacao = "corretor" | "comprador" | "vendedor" | "imobiliaria" | "juridico";

export const PAPEL_APROVACAO_LABEL: Record<TipoPapelAprovacao, string> = {
  corretor: "Corretor",
  comprador: "Comprador",
  vendedor: "Vendedor",
  imobiliaria: "Imobiliária",
  juridico: "Jurídico",
};

export type StatusMinuta = "em_aprovacao" | "aprovada" | "reprovada";
export type StatusAprovacaoMinuta = "pendente" | "aprovada" | "reprovada";
export type StatusContrato =
  | "aguardando_assinatura"
  | "enviado"
  | "assinado"
  | "recusado"
  | "cancelado";

export const STATUS_CONTRATO_LABEL: Record<StatusContrato, string> = {
  aguardando_assinatura: "Aguardando envio para assinatura",
  enviado: "Enviado — aguardando assinaturas",
  assinado: "Assinado por todos",
  recusado: "Assinatura recusada",
  cancelado: "Envio cancelado",
};

export type StatusSignatario = "pendente" | "assinado" | "recusado";

export const STATUS_SIGNATARIO_LABEL: Record<StatusSignatario, string> = {
  pendente: "Pendente",
  assinado: "Assinado",
  recusado: "Recusado",
};

import type { DocMinuta } from "@/lib/minuta-doc";

export interface Minuta {
  cd_minuta: string;
  cd_processo: string;
  cd_criador: string | null;
  nr_versao: number;
  // Uma minuta é um arquivo no Storage (upload manual do Jurídico) OU
  // um texto gerado de um modelo — nunca os dois nulos (ver migration 043).
  ds_storage_url: string | null;
  ds_conteudo: string | null;
  // Documento do editor (negrito, alinhamento...). Quando existe, é o que
  // vale pro PDF; ds_conteudo fica como texto puro equivalente.
  ds_conteudo_json: DocMinuta | null;
  tp_status: StatusMinuta;
  ts_criacao: string;
}

export interface MinutaAprovacao {
  cd_aprovacao: string;
  cd_minuta: string;
  tp_papel: TipoPapelAprovacao;
  cd_usuario: string | null;
  tp_status: StatusAprovacaoMinuta;
  ds_comentario: string | null;
  ts_decisao: string | null;
}

// Convite por e-mail pra uma pessoa ler a minuta e aceitar/recusar (migration 067).
export interface MinutaConvite {
  cd_convite: string; // também é o token do link /aprovar/[token]
  cd_minuta: string;
  tp_papel: TipoPapelAprovacao;
  nm_destinatario: string;
  ds_email: string;
  tp_status: StatusAprovacaoMinuta;
  ds_comentario: string | null;
  ts_envio: string | null; // vazio até o e-mail realmente sair
  ts_decisao: string | null;
}

export interface Contrato {
  cd_contrato: string;
  cd_processo: string;
  cd_minuta: string;
  tp_status: StatusContrato;
  ts_criacao: string;
  // Assinatura digital (migration 045). Nulos enquanto não enviado.
  ds_provedor_assinatura: string | null;
  ds_documento_externo_id: string | null;
  ds_url_documento: string | null;
  ds_arquivo_assinado_url: string | null;
  ds_erro_envio: string | null;
  ts_envio_assinatura: string | null;
  ts_assinatura_concluida: string | null;
}

export interface ContratoSignatario {
  cd_signatario: string;
  cd_contrato: string;
  tp_papel: TipoPapelAprovacao;
  cd_usuario: string | null;
  nm_signatario: string;
  ds_email: string;
  tp_status: StatusSignatario;
  ds_assinatura_externo_id: string | null;
  ds_url_assinatura: string | null;
  ts_assinatura: string | null;
}

// Biblioteca de textos-base de contrato (migration 043). O Jurídico
// monta uma vez, versiona, e gera minutas a partir deles.
export interface ModeloContrato {
  cd_modelo: string;
  nm_modelo: string;
  ds_descricao: string | null;
  ds_conteudo: string;
  nr_versao: number;
  sn_ativo: boolean;
  cd_criador: string | null;
  cd_editor: string | null;
  ts_criacao: string;
  ts_atualizacao: string;
}

export interface ModeloContratoVersao {
  cd_versao: string;
  cd_modelo: string;
  nr_versao: number;
  nm_modelo: string;
  ds_conteudo: string;
  cd_editor: string | null;
  ts_criacao: string;
}

// Campos que fn_render_modelo_contrato (migration 056) troca pelos
// dados do processo. A tela de edição mostra essa lista como ajuda.
// Os campos com _1 valem pra qualquer posição: _2 é o segundo
// vendedor/comprador/corretor, _3 o terceiro... Se não existir, vira
// "__________" pra preencher à mão.
export const CAMPOS_MODELO_CONTRATO: {
  grupo: string;
  campos: { token: string; descricao: string }[];
}[] = [
  {
    grupo: "Geral",
    campos: [
      { token: "{{numero_processo}}", descricao: "Número do processo (ex: SOMA-2026-0007)" },
      { token: "{{data_hoje}}", descricao: "Data de hoje (dd/mm/aaaa)" },
      { token: "{{data_extenso}}", descricao: "Data de hoje por extenso" },
      { token: "{{imobiliaria}}", descricao: "Nome da imobiliária" },
      { token: "{{imobiliaria_cnpj}}", descricao: "CNPJ — também _creci e _endereco" },
    ],
  },
  {
    grupo: "Blocos condicionais",
    campos: [
      { token: "{{#campo}}...{{/campo}}", descricao: "O trecho só entra se o campo tiver valor (ex: {{#vendedor_2}}...{{/vendedor_2}})" },
      { token: "{{^campo}}...{{/campo}}", descricao: "O trecho só entra se o campo estiver vazio" },
      { token: "{{#honorarios_imobiliaria}}", descricao: "Imobiliária participa dos honorários" },
      { token: "{{#vendedor_2_conjuge}}", descricao: "2ª pessoa é cônjuge — também _companheiro, _anuente e _outro" },
      { token: "{{#pagamento_financiado}}", descricao: "Venda financiada — também {{#pagamento_a_vista}}" },
      { token: "{{#imovel_usa_fgts}}", descricao: "Comprador usa FGTS" },
    ],
  },
  {
    grupo: "Vendedores e compradores",
    campos: [
      { token: "{{vendedor}}", descricao: "Todos os vendedores (\"A e B\")" },
      { token: "{{comprador}}", descricao: "Todos os compradores" },
      { token: "{{vendedor_1}}", descricao: "Nome do 1º vendedor (troque o 1 por 2, 3...)" },
      { token: "{{vendedor_1_cpf}}", descricao: "CPF — o digitado, senão o lido dos documentos" },
      { token: "{{vendedor_1_rg}}", descricao: "RG — o digitado, senão o lido dos documentos" },
      { token: "{{vendedor_1_nascimento}}", descricao: "Data de nascimento" },
      { token: "{{vendedor_1_endereco}}", descricao: "Endereço" },
      { token: "{{vendedor_2_vinculo}}", descricao: "Vínculo com a pessoa anterior (cônjuge, companheiro(a)...)" },
      { token: "{{vendedor_1_profissao}}", descricao: "Profissão" },
      { token: "{{vendedor_1_telefone}}", descricao: "Telefone" },
      { token: "{{vendedor_1_email}}", descricao: "E-mail" },
      { token: "{{vendedor_1_conta}}", descricao: "Conta bancária" },
      { token: "{{comprador_1}}", descricao: "Comprador: mesmos campos do vendedor (_cpf, _rg...)" },
    ],
  },
  {
    grupo: "Imóvel",
    campos: [
      { token: "{{imovel_descricao}}", descricao: "Descrição do imóvel (da matrícula: unidade, vaga, áreas, fração ideal)" },
      { token: "{{imovel_endereco}}", descricao: "Endereço do imóvel" },
      { token: "{{imovel_matricula}}", descricao: "Matrícula" },
      { token: "{{imovel_iptu}}", descricao: "Inscrição municipal (IPTU)" },
      { token: "{{imovel_cartorio}}", descricao: "Ex: 3º Ofício de Registro de Imóveis de Salvador/BA — também _numero e _cidade" },
      { token: "{{imovel_valor}}", descricao: "Valor do imóvel (R$)" },
      { token: "{{imovel_valor_extenso}}", descricao: "Valor do imóvel por extenso" },
      { token: "{{imovel_forma_pagamento}}", descricao: "financiamento bancário / à vista" },
      { token: "{{imovel_sinal}}", descricao: "Sinal (também _extenso)" },
      { token: "{{imovel_entrada}}", descricao: "Entrada (também _extenso)" },
      { token: "{{imovel_financiamento}}", descricao: "Saldo financiado (também _extenso)" },
      { token: "{{imovel_saldo_quitacao}}", descricao: "Saldo pra quitação na venda à vista (também _extenso)" },
      { token: "{{imovel_fgts}}", descricao: "Valor do FGTS, se informado (também _extenso)" },
      { token: "{{imovel_banco}}", descricao: "Banco do financiamento" },
      { token: "{{imovel_entrega_chaves}}", descricao: "Entrega das chaves" },
      { token: "{{imovel_itens}}", descricao: "O que fica no imóvel" },
    ],
  },
  {
    grupo: "Honorários",
    campos: [
      { token: "{{honorarios_total}}", descricao: "Total (R$) — também _extenso" },
      { token: "{{honorarios_percentual}}", descricao: "Total em % do valor do imóvel" },
      { token: "{{honorarios_quando}}", descricao: "Quando são pagos" },
      { token: "{{honorarios_imobiliaria}}", descricao: "Parte da imobiliária (R$) — também _extenso e _percentual" },
      { token: "{{honorarios_distribuicao}}", descricao: "Lista pronta: a) imobiliária, b) c) corretores, com valor, extenso, CPF e PIX" },
      { token: "{{corretor}}", descricao: "Todos os corretores" },
      { token: "{{corretor_1}}", descricao: "Nome do 1º corretor (troque o 1 por 2, 3...)" },
      { token: "{{corretor_1_honorario}}", descricao: "Honorário (R$) — também _honorario_extenso" },
      { token: "{{corretor_1_percentual}}", descricao: "% dos honorários" },
      { token: "{{corretor_1_cpf}}", descricao: "CPF (do cadastro de corretores) — também _creci, _pix, _nascimento, _telefone, _email, _conta" },
    ],
  },
];

// Onde cada item entra no PDF/tela — Custos Iniciais x Custos Finais,
// igual o processo manual sempre separou (ver migration 020).
export type TipoSecaoItem = "inicial" | "final";

export interface Orcamento {
  cd_orcamento: string;
  cd_processo: string;
  cd_criador: string;
  nm_cidade: string;
  dt_validade: string;
  tp_status: StatusOrcamento;
  ds_inscricao_municipal: string | null;
  vl_transacao: number | null;
  vl_venal: number | null;
  vl_total_honorarios: number;
  vl_total_custas: number;
  vl_total_geral: number;
  sn_primeiro_imovel: boolean;
  ds_pdf_url: string | null;
  cd_token_aceite: string;
  ts_aceite: string | null;
  ts_criacao: string;
  ts_atualizacao: string;
}

export interface OrcamentoServico {
  cd_orcamento_servico: string;
  cd_orcamento: string;
  cd_servico: string | null;
  ds_descricao: string;
  tp_servico: TipoServico;
  tp_secao: TipoSecaoItem;
  vl_unitario: number;
  nr_quantidade: number;
  vl_subtotal: number;
  sn_selecionado: boolean;
}

export interface OrcamentoAceiteItem {
  cd_orcamento_servico: string;
  ds_descricao: string;
  tp_servico: TipoServico;
  tp_secao: TipoSecaoItem;
  vl_unitario: number;
  nr_quantidade: number;
  vl_subtotal: number;
  sn_selecionado: boolean;
}

export interface OrcamentoAceite {
  cd_orcamento: string;
  nm_cidade: string;
  dt_validade: string;
  tp_status: StatusOrcamento;
  ds_inscricao_municipal: string | null;
  vl_transacao: number | null;
  vl_venal: number | null;
  vl_total_honorarios: number;
  vl_total_custas: number;
  vl_total_geral: number;
  vl_total_aceito: number | null;
  ds_pdf_url: string | null;
  processo: {
    ds_numero_processo: string;
    tp_processo: TipoProcesso;
    nm_comprador_convidado: string | null;
  };
  itens: OrcamentoAceiteItem[];
}

export interface Documento {
  cd_documento: string;
  cd_processo: string;
  cd_enviado_por: string | null;
  tp_perfil_alvo: PerfilDocumento;
  nm_tipo_documento: string;
  nm_arquivo: string;
  ds_storage_url: string;
  tp_status: StatusDocumento;
  cd_validador: string | null;
  ts_validacao: string | null;
  ds_observacoes: string | null;
  ts_criacao: string;
  // Vínculo com o checklist do intake (migration 049), nulos em upload avulso.
  cd_parte: string | null;
  tp_categoria_intake: CategoriaDocIntake | null;
}

export const PERFIL_DOCUMENTO_LABEL: Record<PerfilDocumento, string> = {
  comprador: "Comprador",
  vendedor: "Vendedor",
  imovel: "Imóvel",
  outro: "Outro",
};

export const STATUS_DOCUMENTO_LABEL: Record<StatusDocumento, string> = {
  pendente: "Pendente",
  validado: "Validado",
  rejeitado: "Rejeitado",
};

// --- OCR dos documentos (migration 044) ------------------------------

export type StatusOcr = "na_fila" | "processando" | "concluido" | "falha";

export const STATUS_OCR_LABEL: Record<StatusOcr, string> = {
  na_fila: "Na fila",
  processando: "Lendo documento...",
  concluido: "Leitura concluída",
  falha: "Falha na leitura",
};

export type TipoDocumentoOcr =
  | "rg"
  | "cpf"
  | "cnh"
  | "comprovante_residencia"
  | "matricula_imovel"
  | "certidao"
  | "contrato_social"
  | "outro";

export const TIPO_DOCUMENTO_OCR_LABEL: Record<TipoDocumentoOcr, string> = {
  rg: "RG / Identidade",
  cpf: "CPF",
  cnh: "CNH",
  comprovante_residencia: "Comprovante de residência",
  matricula_imovel: "Matrícula do imóvel",
  certidao: "Certidão",
  contrato_social: "Contrato social",
  outro: "Outro",
};

// Nomes de campo que os parsers produzem (soma.documento_ocr_campos.nm_campo).
export const CAMPO_OCR_LABEL: Record<string, string> = {
  nome: "Nome",
  cpf: "CPF",
  rg: "RG",
  data_nascimento: "Data de nascimento",
  naturalidade: "Naturalidade",
  nacionalidade: "Nacionalidade",
  estado_civil: "Estado civil",
  regime_bens: "Regime de bens",
  data_casamento: "Data do casamento",
  data_emissao: "Data de emissão",
  data_validade: "Validade",
  local_emissao: "Local de emissão",
  estado_emissor: "UF emissora",
  orgao_emissor: "Órgão emissor",
  categoria: "Categoria",
  nome_conjuge_1: "Cônjuge 1",
  nome_conjuge_2: "Cônjuge 2",
  cpf_conjuge_1: "CPF do cônjuge 1",
  cpf_conjuge_2: "CPF do cônjuge 2",
  nome_mae: "Nome da mãe",
  razao_social_lida: "Razão social",
  nire: "NIRE",
  tipo_societario: "Tipo societário",
  nome_pai: "Nome do pai",
  cnh_registro: "Registro da CNH",
  cep: "CEP",
  endereco: "Endereço",
  matricula: "Nº da matrícula",
  cartorio: "Cartório / Registro de Imóveis",
  cnpj: "CNPJ",
  razao_social: "Razão social",
};

export interface DocumentoOcr {
  cd_documento_ocr: string;
  cd_documento: string;
  tp_status: StatusOcr;
  tp_documento_detectado: TipoDocumentoOcr | null;
  ds_texto_extraido: string | null;
  nr_confianca: number | null;
  nr_paginas: number | null;
  ds_erro: string | null;
  ds_motor: string;
  ts_criacao: string;
  ts_processamento: string | null;
  // Conferência por IA (migration 054) — null enquanto não configurada
  // ou não roda (PDF de texto puro não tem imagem pra conferir).
  sn_tipo_confere_ia: boolean | null;
  tp_documento_sugerido_ia: string | null;
  ts_validacao_ia: string | null;
}

export interface DocumentoOcrCampo {
  cd_campo: string;
  cd_documento_ocr: string;
  nm_campo: string;
  ds_valor: string;
  nr_confianca: number | null;
  sn_confirmado: boolean;
  sn_confere_ia: boolean | null;
  ds_valor_sugerido_ia: string | null;
  nr_confianca_ia: number | null;
}

export interface Andamento {
  cd_andamento: string;
  cd_processo: string;
  // Gerado automaticamente por trigger a cada movimento do processo —
  // fica NULL quando o processo ainda não tem despachante atribuído.
  cd_despachante: string | null;
  nm_etapa: string;
  ds_andamento: string;
  ts_criacao: string;
}

export interface Pendencia {
  cd_pendencia: string;
  cd_processo: string;
  cd_responsavel: string | null;
  ds_pendencia: string;
  dt_prazo: string | null;
  tp_status: StatusPendencia;
  ts_criacao: string;
}

export const STATUS_PENDENCIA_LABEL: Record<StatusPendencia, string> = {
  aberta: "Aberta",
  concluida: "Concluída",
  atrasada: "Atrasada",
};

export const ROLE_LABEL: Record<RoleUsuario, string> = {
  master: "Master",
  juridico: "Jurídico",
  imobiliaria: "Imobiliária",
  despachante: "Despachante",
  corretor: "Corretor",
  gerente: "Gerente",
  vendedor: "Vendedor",
  comprador: "Cliente",
  outro_cliente: "Outro cliente",
};

export const TIPO_PROCESSO_LABEL: Record<TipoProcesso, string> = {
  despachante: "Despachante Imobiliário",
  contrato: "Contrato Imobiliário",
};

export const STATUS_LABEL: Record<StatusOrcamento, string> = {
  pendente: "Pendente",
  aceito: "Aceito",
  pago: "Pago",
  liberado: "Liberado",
  reprovado: "Reprovado",
};

// Tabelas oficiais de custas do TJBA (Decreto Judiciário 1075/2025) —
// catálogo de consulta pra tela de Boleto (ver migration 015).
export type TabelaCusta = "TJBA" | "RI" | "NOTAS" | "CRPN";

export const TABELA_CUSTA_LABEL: Record<TabelaCusta, string> = {
  TJBA: "Cartórios Judiciais (Tribunal)",
  RI: "Registro de Imóveis",
  NOTAS: "Tabelionato de Notas",
  CRPN: "Registro Civil das Pessoas Naturais",
};

export const TABELAS_CUSTA: TabelaCusta[] = ["TJBA", "RI", "NOTAS", "CRPN"];

export interface TabelaCustaItem {
  cd_custa: string;
  tp_tabela: TabelaCusta;
  nm_secao: string;
  ds_ato: string;
  cd_ato: string | null;
  vl_faixa_min: number | null;
  vl_faixa_max: number | null;
  vl_pagar: number | null;
  ds_valor_especial: string | null;
  nr_ordem: number;
  sn_desconto_primeiro_imovel: boolean;
}

// Liga um serviço a boletos que devem entrar junto automaticamente no
// orçamento (ver migration 021/023 e /configuracoes/pacotes).
//
// tp_origem "custa": cd_custa aponta pra uma linha fixa da tabela de
// custas. "faixa": sem cd_custa, resolve a linha certa em tempo de
// adição usando tp_tabela_faixa/nm_secao_faixa + a base de cálculo
// (maior entre transação/venal). "itiv": calcula 3% da base direto,
// sem nenhuma linha de tabela_custas envolvida.
export type TipoOrigemPacoteItem = "custa" | "faixa" | "itiv";

// "ambas" duplica o item — uma cobrança nos Custos Iniciais, outra
// nos Finais (caso da Prenotação, mas serve pra qualquer boleto).
export type TipoSecaoPadraoPacoteItem = "inicial" | "final" | "ambas";

export interface PacoteItem {
  cd_pacote_item: string;
  cd_servico: string;
  cd_custa: string | null;
  tp_origem: TipoOrigemPacoteItem;
  tp_tabela_faixa: TabelaCusta | null;
  nm_secao_faixa: string | null;
  tp_secao_padrao: TipoSecaoPadraoPacoteItem;
  sn_opcional: boolean;
}

// Blocos configuráveis da tela de novo orçamento — ver migration 017
// e /configuracoes/fluxo. sn_ativo controla se o bloco aparece de
// verdade em /orcamentos/novo; posicao_x/y é só o layout no canvas.
export type BlocoFluxo =
  | "tipo_processo"
  | "informacoes_basicas"
  | "dados_imovel"
  | "orgao"
  | "tipo_servico"
  | "selecao_servicos"
  | "boletos";

// A quais tipos de processo um bloco se aplica — "ambos" aparece
// tanto pra Despachante quanto pra Contrato; os outros dois valores
// restringem o bloco a um ramo só. Configurável em Configurações >
// Fluxo (ver migration 018), não é mais fixo no código.
export type TipoAplicavelFluxo = "ambos" | "despachante" | "contrato";

export interface FluxoBloco {
  cd_bloco: BlocoFluxo;
  nm_bloco: string;
  sn_ativo: boolean;
  tp_aplicavel: TipoAplicavelFluxo;
  posicao_x: number;
  posicao_y: number;
}

// Dependência lógica entre os blocos — só a estrutura das setas no
// canvas de Configurações > Fluxo. Cor e rótulo de cada seta vêm do
// tp_aplicavel de quem ela liga (dado real, configurável), não são
// mais fixos aqui.
export const FLUXO_CONEXOES: { origem: BlocoFluxo; destino: BlocoFluxo }[] = [
  { origem: "tipo_processo", destino: "informacoes_basicas" },
  { origem: "informacoes_basicas", destino: "dados_imovel" },
  { origem: "informacoes_basicas", destino: "orgao" },
  { origem: "orgao", destino: "tipo_servico" },
  { origem: "tipo_servico", destino: "selecao_servicos" },
  { origem: "informacoes_basicas", destino: "selecao_servicos" },
  { origem: "selecao_servicos", destino: "boletos" },
  { origem: "dados_imovel", destino: "boletos" },
];
