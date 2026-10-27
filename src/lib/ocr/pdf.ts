// Leitura de PDF com MuPDF (WASM puro, sem toolchain nativo). Dois
// caminhos: se o PDF já tem camada de texto (gerado digitalmente —
// contrato, CPF da Receita, certidão online), pega o texto direto;
// se é digitalizado (só imagem), rasteriza as páginas pro Tesseract.

const ESCALA_RASTER = 2; // ~144 dpi, suficiente pro Tesseract
const MIN_CHARS_TEXTO_NATIVO = 200;
const MIN_CHARS_PAGINA_COM_TEXTO = 80;

export type PaginaImagem = { pagina: number; imagem: Uint8Array };

export type LeituraPdf =
  // paginasSemTexto: PDF "misto" (ex: contrato social da Junta — capa digital
  // com o carimbo e o conteúdo escaneado); essas páginas vão pro Tesseract.
  | { fonte: "pdf-nativo"; texto: string; paginas: number; paginasSemTexto: PaginaImagem[] }
  | { fonte: "raster"; paginas: PaginaImagem[]; totalPaginas: number };

// Primeira página como PNG — pra IA ler o que, em PDF "misto", é imagem
// (ex: matrícula do cartório: carimbo em texto, corpo escaneado).
export async function rasterizarPrimeiraPagina(buffer: Buffer): Promise<Buffer | null> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");
  try {
    if (doc.countPages() === 0) return null;
    const page = doc.loadPage(0);
    try {
      const pix = page.toPixmap(
        mupdf.Matrix.scale(3, 3), // ~216 dpi: matrícula tem letra miúda
        mupdf.ColorSpace.DeviceRGB,
        false,
        true
      );
      try {
        return Buffer.from(pix.asPNG());
      } finally {
        pix.destroy?.();
      }
    } finally {
      page.destroy?.();
    }
  } finally {
    doc.destroy?.();
  }
}

export async function lerPdf(buffer: Buffer, maxPaginas: number): Promise<LeituraPdf> {
  const mupdf = await import("mupdf");
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");

  try {
    const totalPaginas = doc.countPages();
    const limite = Math.min(totalPaginas, maxPaginas);

    const textos: string[] = [];
    // Página que é, em sua maior parte, uma imagem (scan).
    const escaneadas: boolean[] = [];
    for (let i = 0; i < limite; i++) {
      const page = doc.loadPage(i);
      try {
        const st = page.toStructuredText("preserve-whitespace,preserve-images");
        try {
          textos.push(st.asText().trim());
          const [px0, py0, px1, py1] = page.getBounds();
          const areaPagina = (px1 - px0) * (py1 - py0);
          let areaImagem = 0;
          st.walk({
            onImageBlock(bbox) {
              areaImagem += Math.max(0, bbox[2] - bbox[0]) * Math.max(0, bbox[3] - bbox[1]);
            },
          });
          escaneadas.push(areaPagina > 0 && areaImagem / areaPagina > 0.5);
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
      const paginasSemTexto: PaginaImagem[] = [];
      const matrizMisto = mupdf.Matrix.scale(ESCALA_RASTER, ESCALA_RASTER);
      for (const [i, t] of textos.entries()) {
        if (!escaneadas[i] && t.replace(/\s/g, "").length >= MIN_CHARS_PAGINA_COM_TEXTO) continue;
        const page = doc.loadPage(i);
        try {
          const pix = page.toPixmap(matrizMisto, mupdf.ColorSpace.DeviceRGB, false, true);
          try {
            paginasSemTexto.push({ pagina: i + 1, imagem: pix.asPNG() });
          } finally {
            pix.destroy?.();
          }
        } finally {
          page.destroy?.();
        }
      }
      return { fonte: "pdf-nativo", texto: textoNativo, paginas: limite, paginasSemTexto };
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
