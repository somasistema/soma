import type { PaginaImagem } from "./pdf";
import { prepararParaOcr } from "./preprocessar";

export type ResultadoOcr = { texto: string; confianca: number };

// Tesseract.js roda 100% no processo do Node — o único download é o
// pacote de idioma `por.traineddata` (~15 MB), buscado uma vez e
// cacheado. Para não depender de CDN, aponte OCR_TESSDATA_PATH para uma
// pasta local com o arquivo (ver .env.example).
const LANG = "por";

export async function reconhecer(paginas: PaginaImagem[]): Promise<ResultadoOcr> {
  if (paginas.length === 0) return { texto: "", confianca: 0 };

  const { createWorker } = await import("tesseract.js");

  const tessdataPath = process.env.OCR_TESSDATA_PATH || undefined;
  // Em produção não definimos OCR_TESSDATA_PATH: baixa o por.traineddata
  // desta CDN (mesma que o tesseract.js usa por padrão) e cacheia em
  // /tmp. Local, aponta pra pasta com o arquivo e não baixa nada.
  const CDN_TESSDATA = "https://tessdata.projectnaptha.com/4.0.0";

  const worker = await createWorker(LANG, 1, {
    langPath: tessdataPath ?? CDN_TESSDATA,
    cachePath: process.env.OCR_TESSDATA_CACHE || "/tmp/tesseract",
    gzip: !tessdataPath,
    logger: () => {},
    errorHandler: (e: unknown) => console.error("[ocr] tesseract:", e),
  });

  try {
    const partes: string[] = [];
    const confiancas: number[] = [];

    for (const { pagina, imagem } of paginas) {
      const preparada = await prepararParaOcr(Buffer.from(imagem));
      const { data } = await worker.recognize(preparada);
      partes.push(`--- Página ${pagina} ---\n${data.text.trim()}`);
      if (typeof data.confidence === "number") confiancas.push(data.confidence);
    }

    const confianca =
      confiancas.length > 0
        ? Math.round((confiancas.reduce((a, b) => a + b, 0) / confiancas.length) * 100) / 100
        : 0;

    return { texto: partes.join("\n\n").trim(), confianca };
  } finally {
    await worker.terminate();
  }
}
