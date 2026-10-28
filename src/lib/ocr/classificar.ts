import type { TipoDocumentoOcr } from "@/types/database";

const DIACRITICOS = /[̀-ͯ]/g;

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();
}

// Palavras-chave por tipo, checadas na ordem (a primeira que casar
// vence). O nome que o usuário deu ao documento (nm_tipo_documento)
// tem prioridade; o texto lido pelo OCR é o desempate.
//
// A ordem importa: certidão de registro civil vem ANTES da matrícula (o rodapé
// "Cartório de Registro Civil" não pode virar "registro de imóveis"), e "cnpj"
// não conta como contrato social — toda conta de luz traz o CNPJ da concessionária.
const REGRAS: { tipo: TipoDocumentoOcr; termos: string[] }[] = [
  {
    tipo: "certidao",
    termos: [
      "registro civil",
      "certidao de nascimento",
      "certidao de casamento",
      "certidao de obito",
      "certidao de divorcio",
      "pessoas naturais",
    ],
  },
  {
    tipo: "matricula_imovel",
    termos: ["matricula", "registro de imoveis", "livro no 2", "certidao de onus"],
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
    tipo: "comprovante_residencia",
    termos: [
      "fatura",
      "conta de energia",
      "conta de agua",
      "conta de luz",
      "nota fiscal",
      "coelba",
      "embasa",
      "neoenergia",
      "codigo do cliente",
      "unidade consumidora",
      "energia eletrica",
      "instalacao",
      "valor a pagar",
      "consumo",
    ],
  },
  {
    tipo: "contrato_social",
    termos: [
      "contrato social",
      "junta comercial",
      "sociedade empresaria",
      "capital social",
      "alteracao contratual",
      "nire",
    ],
  },
  { tipo: "certidao", termos: ["certidao", "certifico", "para os devidos fins"] },
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
