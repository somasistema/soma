import type { TipoDocumentoOcr } from "@/types/database";

const DIACRITICOS = /[̀-ͯ]/g;

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}

// Palavras-chave por tipo, checadas na ordem (a primeira que casar
// vence). O nome que o usuário deu ao documento (nm_tipo_documento)
// tem prioridade; o texto lido pelo OCR é o desempate.
const REGRAS: { tipo: TipoDocumentoOcr; termos: string[] }[] = [
  {
    tipo: "matricula_imovel",
    termos: ["matricula", "registro de imoveis", "livro no 2", "cartorio de registro"],
  },
  {
    tipo: "cnh",
    termos: [
      "carteira nacional de habilitacao",
      "cnh",
      "permissao para dirigir",
      "condutor",
    ],
  },
  {
    tipo: "rg",
    termos: [
      "registro geral",
      "carteira de identidade",
      "secretaria de seguranca",
      "instituto de identificacao",
      "identidade",
    ],
  },
  {
    tipo: "cpf",
    termos: [
      "cadastro de pessoa fisica",
      "cadastro de pessoas fisicas",
      "comprovante de inscricao",
      "receita federal",
    ],
  },
  {
    tipo: "contrato_social",
    termos: [
      "contrato social",
      "junta comercial",
      "cnpj",
      "sociedade empresaria",
      "capital social",
    ],
  },
  { tipo: "certidao", termos: ["certidao", "certifico", "para os devidos fins"] },
  {
    tipo: "comprovante_residencia",
    termos: [
      "fatura",
      "conta de energia",
      "conta de agua",
      "nota fiscal",
      "coelba",
      "embasa",
      "codigo do cliente",
      "instalacao",
    ],
  },
];

export function classificarDocumento(
  nmTipoDocumento: string,
  textoExtraido: string
): TipoDocumentoOcr {
  const nome = normalizar(nmTipoDocumento);
  const corpo = normalizar(textoExtraido).slice(0, 4000);

  for (const regra of REGRAS) {
    if (regra.termos.some((termo) => nome.includes(termo))) return regra.tipo;
  }
  for (const regra of REGRAS) {
    if (regra.termos.some((termo) => corpo.includes(termo))) return regra.tipo;
  }
  return "outro";
}
