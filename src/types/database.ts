export type RoleUsuario =
  | "master"
  | "juridico"
  | "imobiliaria"
  | "despachante"
  | "corretor"
  | "vendedor"
  | "comprador"
  | "outro_cliente";

export type TipoProcesso =
  | "a_vista"
  | "financiamento"
  | "consorcio"
  | "locacao"
  | "averbacao"
  | "inventario";

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
  | "SOMA";

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

// As 3 cidades onde a SOMA opera hoje — dirigem a busca de preço no
// catálogo (soma.servico_precos). Adicionar uma cidade nova aqui não
// exige migration, só cadastrar os preços dela nos serviços.
export const CIDADES_SERVICO = ["Salvador", "Lauro de Freitas", "Camaçari"] as const;

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
};

// Ordem de exibição das abas — do mais usado ao mais raro.
export const LOCAIS_SERVICO: LocalServico[] = [
  "CRI",
  "NOTAS",
  "RCPN",
  "SEFAZ",
  "SEDUR",
  "SOMA",
  "RF",
  "TJ",
  "TRT",
  "TRF",
];

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

export interface Orcamento {
  cd_orcamento: string;
  cd_processo: string;
  cd_criador: string;
  nm_cidade: string;
  dt_validade: string;
  tp_status: StatusOrcamento;
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
  vl_unitario: number;
  nr_quantidade: number;
  vl_subtotal: number;
  sn_selecionado: boolean;
}

export interface OrcamentoAceiteItem {
  cd_orcamento_servico: string;
  ds_descricao: string;
  tp_servico: TipoServico;
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
  cd_despachante: string;
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
  comprador: "Comprador",
  outro_cliente: "Outro cliente",
};

export const TIPO_PROCESSO_LABEL: Record<TipoProcesso, string> = {
  a_vista: "À vista",
  financiamento: "Financiamento",
  consorcio: "Consórcio",
  locacao: "Locação",
  averbacao: "Averbação",
  inventario: "Inventário",
};

export const STATUS_LABEL: Record<StatusOrcamento, string> = {
  pendente: "Pendente",
  aceito: "Aceito",
  pago: "Pago",
  liberado: "Liberado",
  reprovado: "Reprovado",
};
