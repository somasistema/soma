export type RoleUsuario =
  | "master"
  | "juridico"
  | "imobiliaria"
  | "despachante"
  | "corretor"
  | "vendedor"
  | "comprador"
  | "outro_cliente";

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
  ts_criacao: string;
}

export interface Imobiliaria {
  cd_imobiliaria: string;
  nm_imobiliaria: string;
  ds_cnpj: string | null;
  ds_telefone: string | null;
  ds_email: string | null;
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
  ts_criacao: string;
  ts_atualizacao: string;
}

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
