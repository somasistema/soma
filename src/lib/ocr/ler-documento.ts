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

const CATEGORIAS_PESSOAIS = ["identidade", "estado_civil", "uniao_estavel"];
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
  const { texto, confianca, paginas, imagemPrincipal } = await extrairTexto(
    params.arquivo,
    params.contentType,
    params.nomeArquivo
  );

  const tipoDetectado = classificarDocumento(params.rotuloTipo, texto);
  let campos: CampoLido[] = extrairCampos(tipoDetectado, texto);

  const pessoal = CATEGORIAS_PESSOAIS.includes(params.categoria);
  if ((campos.length === 0 || pessoal) && imagemPrincipal) {
    const leitura = await lerDocumentoComIA({
      imagem: imagemPrincipal.dados,
      mimeType: imagemPrincipal.mimeType,
      complemento: campos.length > 0,
    });
    if (leitura && leitura.campos.length > 0) {
      const daIA: CampoLido[] = leitura.campos
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
    dadosImovel = (await lerDadosImovelComIA({ texto, imagem: imagemPrincipal })) ?? {
      endereco: null,
      matricula: campos.find((c) => c.nm_campo === "matricula")?.ds_valor ?? null,
      inscricaoMunicipal: null,
      cartorioCodigo: null,
    };
  }

  return { tipoDetectado, confianca, paginas, texto, campos, dadosImovel };
}
