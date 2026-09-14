// Prepara a imagem antes do Tesseract: converte pra tons de cinza e
// estica o contraste pra faixa real de cinza usada no documento (em
// vez de 0–255 completo). Ajuda muito em foto de RG/CNH, que tem fundo
// de segurança (holografia, guilhoché, marca d'água) que o Tesseract
// tenta ler como texto — o fundo normalmente é mais claro/baixo
// contraste que a tinta do texto, então esticar o contraste empurra
// esse ruído pra perto do branco e deixa o texto mais escuro/nítido.
//
// Não faz binarização dura (preto/branco puro) de propósito: em foto
// com iluminação desigual isso arrisca apagar texto de verdade. Se
// falhar por qualquer motivo, devolve a imagem original sem quebrar o
// OCR.
export async function prepararParaOcr(buffer: Buffer): Promise<Buffer> {
  try {
    const mupdf = await import("mupdf");

    const imagem = new mupdf.Image(buffer);
    let pix = imagem.toPixmap();
    pix = pix.convertToColorSpace(mupdf.ColorSpace.DeviceGray);

    const pixels = pix.getPixels();
    const n = pix.getNumberOfComponents(); // 1 (cinza) ou 2 (cinza + alfa)

    let min = 255;
    let max = 0;
    for (let i = 0; i < pixels.length; i += n) {
      const v = pixels[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }

    const faixa = max - min;
    // Faixa muito pequena = imagem já quase uniforme (ou algo deu
    // errado na leitura) — esticar só amplificaria ruído.
    if (faixa > 20) {
      const escala = 255 / faixa;
      for (let i = 0; i < pixels.length; i += n) {
        pixels[i] = Math.min(255, Math.max(0, Math.round((pixels[i] - min) * escala)));
      }
    }

    return Buffer.from(pix.asPNG());
  } catch (erro) {
    console.error("[ocr] falha ao pré-processar a imagem, usando original:", erro);
    return buffer;
  }
}
