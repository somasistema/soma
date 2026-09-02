// Leitura de PDF com MuPDF (WASM puro, sem toolchain nativo). Dois
// caminhos: se o PDF já tem camada de texto (gerado digitalmente —
// contrato, CPF da Receita, certidão online), pega o texto direto;
// se é digitalizado (só imagem), rasteriza as páginas pro Tesseract.

const ESCALA_RASTER = 2; // ~144 dpi, suficiente pro Tesseract
const MIN_CHARS_TEXTO_NATIVO = 200;

export type PaginaImagem = { pagina: number; imagem: Uint8Array };

export type LeituraPdf =
  | { fonte: "pdf-nativo"; texto: string; paginas: number }
  | { fonte: "raster"; paginas: PaginaImagem[]; totalPaginas: number };

export async function lerPdf(buffer: Buffer, maxPaginas: number): Promise<LeituraPdf> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");

  try {
    const totalPaginas = doc.countPages();
    const limite = Math.min(totalPaginas, maxPaginas);

    const textos: string[] = [];
    for (let i = 0; i < limite; i++) {
      const page = doc.loadPage(i);
      try {
        const st = page.toStructuredText("preserve-whitespace");
        try {
          textos.push(st.asText().trim());
        } finally {
          st.destroy?.();
        }
      } finally {
        page.destroy?.();
      }
    }

    const textoNativo = textos.join("\n\n").trim();
    const chars = textoNativo.replace(/\s/g, "").length;

    if (chars >= MIN_CHARS_TEXTO_NATIVO) {
      return { fonte: "pdf-nativo", texto: textoNativo, paginas: limite };
    }

    // Sem camada de texto útil — rasteriza pro Tesseract.
    const paginas: PaginaImagem[] = [];
    const matriz = mupdf.Matrix.scale(ESCALA_RASTER, ESCALA_RASTER);
    for (let i = 0; i < limite; i++) {
      const page = doc.loadPage(i);
      try {
        const pix = page.toPixmap(matriz, mupdf.ColorSpace.DeviceRGB, false, true);
        try {
          paginas.push({ pagina: i + 1, imagem: pix.asPNG() });
        } finally {
          pix.destroy?.();
        }
      } finally {
        page.destroy?.();
      }
    }

    return { fonte: "raster", paginas, totalPaginas: limite };
  } finally {
    doc.destroy?.();
  }
}
