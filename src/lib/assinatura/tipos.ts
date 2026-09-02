import type { TipoPapelAprovacao } from "@/types/database";

export type SignatarioEntrada = {
  tp_papel: TipoPapelAprovacao;
  nome: string;
  email: string;
  cd_usuario: string | null;
};

export type ArquivoParaAssinar = {
  nome: string;
  conteudo: Buffer;
  tipo: string; // MIME
};

export type SignatarioCriado = {
  tp_papel: TipoPapelAprovacao;
  assinaturaExternoId: string | null; // public_id no provedor, casa com o webhook
  urlAssinatura: string | null;
};

export type DocumentoCriado = {
  documentoExternoId: string;
  urlDocumento: string | null;
  signatarios: SignatarioCriado[];
};

// Contrato mínimo que a app precisa de qualquer serviço de assinatura.
// Trocar de provedor = nova implementação disto, nada além.
export interface ProvedorAssinatura {
  readonly nome: string;
  criarDocumento(params: {
    titulo: string;
    arquivo: ArquivoParaAssinar;
    signatarios: SignatarioEntrada[];
  }): Promise<DocumentoCriado>;
  // PDF final com as assinaturas; null se ainda não disponível.
  baixarAssinado(documentoExternoId: string): Promise<Buffer | null>;
}
