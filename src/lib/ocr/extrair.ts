import { lerPdf } from "./pdf";
import { reconhecer } from "./tesseract";

const MAX_PAGINAS_PADRAO = 5;

export type FonteTexto = "pdf-nativo" | "ocr-pdf" | "ocr-imagem";

export type ImagemPrincipal = { dados: Buffer; mimeType: string };

export type TextoExtraido = {
  texto: string;
  confianca: number; // 0–100
  paginas: number;
  fonte: FonteTexto;
  // Primeira página como imagem, pra conferência por IA (visão). Nula
  // em PDF com camada de texto — não tem raster gerado.
  imagemPrincipal: ImagemPrincipal | null;
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
    return {
      texto,
      confianca,
      paginas: 1,
      fonte: "ocr-imagem",
      imagemPrincipal: { dados: buffer, mimeType: contentType || "image/jpeg" },
    };
  }

  const leitura = await lerPdf(buffer, maxPaginas);

  if (leitura.fonte === "pdf-nativo") {
    return {
      texto: leitura.texto,
      confianca: 99,
      paginas: leitura.paginas,
      fonte: "pdf-nativo",
      imagemPrincipal: null,
    };
  }

  const { texto, confianca } = await reconhecer(leitura.paginas);
  const primeira = leitura.paginas[0];
  return {
    texto,
    confianca,
    paginas: leitura.totalPaginas,
    fonte: "ocr-pdf",
    imagemPrincipal: primeira ? { dados: Buffer.from(primeira.imagem), mimeType: "image/png" } : null,
  };
}
