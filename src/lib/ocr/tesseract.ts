import type { PaginaImagem } from "./pdf";

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

  const worker = await createWorker(LANG, 1, {
    // Com OCR_TESSDATA_PATH apontando pra uma pasta local, lê o
    // por.traineddata (sem .gz) de lá; sem a env, baixa da CDN e cacheia.
    langPath: tessdataPath,
    cachePath: process.env.OCR_TESSDATA_CACHE || "/tmp/tesseract",
    gzip: !tessdataPath,
    logger: () => {},
    errorHandler: (e: unknown) => console.error("[ocr] tesseract:", e),
  });

  try {
    const partes: string[] = [];
    const confiancas: number[] = [];

    for (const { pagina, imagem } of paginas) {
      const { data } = await worker.recognize(Buffer.from(imagem));
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
