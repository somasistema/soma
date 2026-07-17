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

export interface Servico {
  cd_servico: string;
  nm_servico: string;
  ds_descricao: string | null;
  tp_servico: TipoServico;
  vl_servico: number;
  sn_ativo: boolean;
  ts_criacao: string;
  ts_atualizacao: string;
}

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
}

export interface OrcamentoAceiteItem {
  ds_descricao: string;
  tp_servico: TipoServico;
  vl_unitario: number;
  nr_quantidade: number;
  vl_subtotal: number;
}

export interface OrcamentoAceite {
  cd_orcamento: string;
  nm_cidade: string;
  dt_validade: string;
  tp_status: StatusOrcamento;
  vl_total_honorarios: number;
  vl_total_custas: number;
  vl_total_geral: number;
  ds_pdf_url: string | null;
  processo: {
    ds_numero_processo: string;
    tp_processo: TipoProcesso;
    nm_comprador_convidado: string | null;
  };
  itens: OrcamentoAceiteItem[];
}

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
