// Tipos, preços e rótulos das consultas pagas (certidões e protesto). Sem fetch nem segredo:
// pode ir para o navegador. As chamadas ao fornecedor ficam em apibrasil.ts (servidor).

export type TipoConsultaPaga = "certidao_federal" | "certidao_estadual" | "protesto" | "cnd_municipal";

export type ResultadoConsultaPaga = "negativa" | "com_efeitos" | "positiva" | "desconhecido";

export type ConsultaPaga = {
  cd_consulta: string;
  cd_parte: string | null;
  tp_consulta: TipoConsultaPaga;
  ds_documento: string;
  ds_uf: string | null;
  tp_resultado: ResultadoConsultaPaga;
  ds_resumo: string | null;
  dt_validade: string | null; // AAAA-MM-DD
  vl_custo: number;
  sn_homologacao: boolean;
  ts_criacao: string;
  // Detalhe devolvido pelo fornecedor (quando há): texto da prefeitura e link do comprovante.
  detalhe?: string | null;
  comprovante?: string | null;
};

export const UF_CERTIDAO_ESTADUAL = "BA";

export const CONSULTA_PAGA_INFO: Record<
  TipoConsultaPaga,
  { rotulo: string; custo: number; descricao: string; comValidade: boolean }
> = {
  certidao_federal: {
    rotulo: "Certidão federal",
    custo: 0.72,
    descricao: "Débitos de tributos federais e dívida ativa da União (Receita e PGFN)",
    comValidade: true,
  },
  certidao_estadual: {
    rotulo: `Certidão estadual (${UF_CERTIDAO_ESTADUAL})`,
    custo: 1.8,
    descricao: "Débitos de tributos do estado da Bahia",
    comValidade: true,
  },
  protesto: {
    rotulo: "Protestos",
    custo: 20.85,
    descricao: "Protestos em cartório no CPF, com cartório, data e valor",
    comValidade: false,
  },
  cnd_municipal: {
    rotulo: "Certidão negativa municipal (Salvador)",
    custo: 0.22,
    descricao: "Débitos de tributos da Prefeitura de Salvador (IPTU e outros), consulta pelo CPF ou CNPJ",
    comValidade: true,
  },
};

// Consulta que vale para o imóvel (feita no documento do vendedor), não para a parte em si.
export const CONSULTAS_DO_IMOVEL: TipoConsultaPaga[] = ["cnd_municipal"];

// Quais consultas cada tipo de pessoa pode fazer. Protesto só para pessoa física.
export function consultasDaPessoa(pessoaJuridica: boolean): TipoConsultaPaga[] {
  return pessoaJuridica ? ["certidao_federal"] : ["certidao_federal", "certidao_estadual", "protesto"];
}

// pendenciaCriada: o resultado trouxe débito ou protesto e o sistema abriu uma pendência no processo.
export type ResultadoAcaoConsulta =
  | { ok: true; consulta: ConsultaPaga; pendenciaCriada: boolean }
  | { ok: false; erro: string };
