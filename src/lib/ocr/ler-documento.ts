import { classificarDocumento } from "./classificar";
import { lerDadosImovelComIA, type DadosImovelLidos } from "./dados-imovel";
import { extrairTexto } from "./extrair";
import { extrairCampos, type CampoLido } from "./parsers";
import { lerDocumentoComIA } from "./validar-ia";

export type LeituraDocumento = {
  tipoDetectado: string;
  confianca: number;
  paginas: number;
  texto: string;
  campos: CampoLido[];
  dadosImovel: DadosImovelLidos | null;
};

const CATEGORIAS_PESSOAIS = [
  "identidade",
  "estado_civil",
  "uniao_estavel",
  "comprovante_residencia",
  "contrato_social",
];

// A IA às vezes dá um nome próprio ao campo; aqui voltam pro nome padrão.
const APELIDOS_CAMPO: Record<string, string> = {
  documento_identidade: "rg",
  doc_identidade: "rg",
  numero_rg: "rg",
  rg_numero: "rg",
  numero_oab: "rg",
  oab: "rg",
};

export function normalizarNomesCampos<T extends { nm_campo: string }>(campos: T[]): T[] {
  return campos.map((c) => ({ ...c, nm_campo: APELIDOS_CAMPO[c.nm_campo] ?? c.nm_campo }));
}
const CATEGORIAS_IMOVEL = ["iptu", "onus_escritura"];

// Leitura de um documento sem tocar no banco: usada no cadastro do
// processo, onde o documento ainda não tem processo. Mesma lógica de
// processarOcr (Tesseract + regex; IA lê a imagem inteira pra
// identidade/certidão e pro imóvel).
export async function lerDocumento(params: {
  arquivo: ArrayBuffer;
  contentType: string | null;
  nomeArquivo: string;
  categoria: string;
  rotuloTipo: string;
}): Promise<LeituraDocumento> {
  const { texto, confianca, paginas, imagemPrincipal, imagemPaginaPdf } = await extrairTexto(
    params.arquivo,
    params.contentType,
    params.nomeArquivo
  );

  const tipoDetectado = classificarDocumento(params.rotuloTipo, texto);
  let campos: CampoLido[] = extrairCampos(tipoDetectado, texto);

  const pessoal = CATEGORIAS_PESSOAIS.includes(params.categoria);
  if ((campos.length === 0 || pessoal) && (imagemPrincipal || texto.trim())) {
    const leitura = await lerDocumentoComIA({
      imagem: imagemPrincipal?.dados ?? null,
      mimeType: imagemPrincipal?.mimeType ?? null,
      texto: imagemPrincipal ? null : texto,
      complemento: campos.length > 0,
    });
    if (leitura && leitura.campos.length > 0) {
      const daIA: CampoLido[] = normalizarNomesCampos(leitura.campos)
        .filter((c) => c.nm_campo && c.ds_valor?.trim())
        .map((c) => ({
          nm_campo: c.nm_campo,
          ds_valor: c.ds_valor.trim(),
          nr_confianca: c.confianca,
        }));
      const nomesIA = new Set(daIA.map((c) => c.nm_campo));
      campos = [...daIA, ...campos.filter((c) => !nomesIA.has(c.nm_campo))];
    }
  }

  let dadosImovel: DadosImovelLidos | null = null;
  if (CATEGORIAS_IMOVEL.includes(params.categoria)) {
    dadosImovel = (await lerDadosImovelComIA({ texto, imagem: imagemPrincipal ?? imagemPaginaPdf ?? null })) ?? {
      endereco: null,
      matricula: campos.find((c) => c.nm_campo === "matricula")?.ds_valor ?? null,
      inscricaoMunicipal: null,
      cartorioCodigo: null,
      descricao: null,
    };
  }

  return { tipoDetectado, confianca, paginas, texto, campos, dadosImovel };
}
