import { lerPdf } from "./pdf";
import { reconhecer } from "./tesseract";

const MAX_PAGINAS_PADRAO = 5;

export type FonteTexto = "pdf-nativo" | "ocr-pdf" | "ocr-imagem";

export type TextoExtraido = {
  texto: string;
  confianca: number; // 0–100
  paginas: number;
  fonte: FonteTexto;
};

function ehPdf(contentType: string | null, nomeArquivo: string) {
  return contentType?.includes("pdf") === true || nomeArquivo.toLowerCase().endsWith(".pdf");
}

// Ponto de entrada: recebe o arquivo cru, devolve texto + de onde veio.
// PDF com camada de texto não passa pelo Tesseract (mais rápido e exato).
export async function extrairTexto(
  arquivo: ArrayBuffer,
  contentType: string | null,
  nomeArquivo: string
): Promise<TextoExtraido> {
  const maxPaginas = Number(process.env.OCR_MAX_PAGINAS ?? MAX_PAGINAS_PADRAO);
  const buffer = Buffer.from(arquivo);

  if (!ehPdf(contentType, nomeArquivo)) {
    const { texto, confianca } = await reconhecer([{ pagina: 1, imagem: buffer }]);
    return { texto, confianca, paginas: 1, fonte: "ocr-imagem" };
  }

  const leitura = await lerPdf(buffer, maxPaginas);

  if (leitura.fonte === "pdf-nativo") {
    return { texto: leitura.texto, confianca: 99, paginas: leitura.paginas, fonte: "pdf-nativo" };
  }

  const { texto, confianca } = await reconhecer(leitura.paginas);
  return { texto, confianca, paginas: leitura.totalPaginas, fonte: "ocr-pdf" };
}
