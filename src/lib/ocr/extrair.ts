import { detectarGiroComIA, girarImagem, normalizarImagem } from "./orientacao";
import { lerPdf, rasterizarPrimeiraPagina } from "./pdf";
import { reconhecer } from "./tesseract";

const MAX_PAGINAS_PADRAO = 5;
// Abaixo disso o Tesseract provavelmente leu a foto torta: testa girar.
const LIMIAR_CONFIANCA_GIRO = 60;
const GANHO_MINIMO_GIRO = 8;

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
  // PDF com texto nativo: 1ª página rasterizada, só pra leitura do imóvel
  // (matrícula escaneada com carimbo em texto).
  imagemPaginaPdf?: ImagemPrincipal | null;
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
    let imagem = await normalizarImagem(buffer, contentType);
    let leitura = await reconhecer([{ pagina: 1, imagem: imagem.dados }]);

    // Leitura fraca: a foto pode estar girada (de cabeça pra baixo, de lado). A IA de
    // visão diz o giro certo; sem chave da API, tenta as outras posições e fica com a
    // que o Tesseract leu com mais confiança (só se melhorar de verdade).
    if (leitura.confianca < LIMIAR_CONFIANCA_GIRO) {
      const giro = await detectarGiroComIA(imagem);
      if (giro !== null) {
        if (giro !== 0) {
          imagem = await girarImagem(imagem, giro);
          leitura = await reconhecer([{ pagina: 1, imagem: imagem.dados }]);
        }
      } else {
        let melhor = { imagem, leitura };
        for (const graus of [180, 90, 270] as const) {
          const girada = await girarImagem(imagem, graus);
          const lida = await reconhecer([{ pagina: 1, imagem: girada.dados }]);
          if (lida.confianca > melhor.leitura.confianca + GANHO_MINIMO_GIRO) {
            melhor = { imagem: girada, leitura: lida };
          }
        }
        imagem = melhor.imagem;
        leitura = melhor.leitura;
      }
    }

    return {
      texto: leitura.texto,
      confianca: leitura.confianca,
      paginas: 1,
      fonte: "ocr-imagem",
      imagemPrincipal: { dados: imagem.dados, mimeType: imagem.mimeType },
    };
  }

  const leitura = await lerPdf(buffer, maxPaginas);

  if (leitura.fonte === "pdf-nativo") {
    let texto = leitura.texto;
    let confianca = 99;
    if (leitura.paginasSemTexto.length > 0) {
      const ocr = await reconhecer(leitura.paginasSemTexto);
      texto = `${texto}\n\n${ocr.texto}`.trim();
      confianca = Math.min(confianca, ocr.confianca);
    }
    return {
      texto,
      confianca,
      paginas: leitura.paginas,
      fonte: "pdf-nativo",
      imagemPrincipal: null,
      // PDF "digital" pode ter só a assinatura em texto e os dados (CNH-e, certidão) como
      // desenho: a 1ª página vai como imagem pra IA ler o que a camada de texto não tem.
      imagemPaginaPdf: await rasterizarPrimeiraPagina(buffer)
        .then((dados) => (dados ? normalizarImagem(dados, "image/png") : null))
        .catch(() => null),
    };
  }

  const { texto, confianca } = await reconhecer(leitura.paginas);
  const primeira = leitura.paginas[0];
  return {
    texto,
    confianca,
    paginas: leitura.totalPaginas,
    fonte: "ocr-pdf",
    imagemPrincipal: primeira ? await normalizarImagem(Buffer.from(primeira.imagem), "image/png") : null,
  };
}
