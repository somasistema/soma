// Preparo de arquivo NO NAVEGADOR antes de mandar pro servidor.
//
// A Vercel recusa corpo de requisição acima de ~4,5 MB e responde sem conteúdo; o Next então
// recarrega a página inteira ("This page couldn't load") e quem estava preenchendo perde o que
// digitou. Foto de celular passa fácil desse tamanho, e PDF escaneado também. Foto é reduzida aqui
// (a leitura do documento já normaliza pra 2400 px de qualquer jeito); PDF grande não dá pra
// comprimir no navegador, então a pessoa é avisada antes de enviar.

export const LIMITE_UPLOAD_BYTES = 4 * 1024 * 1024;
const REDUZIR_ACIMA_DE = 1.2 * 1024 * 1024;
const LADO_MAXIMO = 2400;

const mb = (bytes: number) => (bytes / 1048576).toFixed(1).replace(".", ",");

async function reduzirImagem(arquivo: File): Promise<File> {
  // from-image: respeita a orientação gravada pela câmera
  const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.fillStyle = "#ffffff"; // PNG com transparência vira fundo branco
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("não foi possível reduzir a imagem");
  return new File([blob], arquivo.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

export async function prepararArquivo(arquivo: File): Promise<{ arquivo: File } | { erro: string }> {
  let atual = arquivo;

  if (atual.type.startsWith("image/") && atual.size > REDUZIR_ACIMA_DE) {
    try {
      const reduzido = await reduzirImagem(atual);
      if (reduzido.size < atual.size) atual = reduzido;
    } catch {
      // formato que o navegador não abre (ex.: HEIC): segue com o original e o limite abaixo decide
    }
  }

  if (atual.size > LIMITE_UPLOAD_BYTES) {
    const dica =
      atual.type === "application/pdf" || /\.pdf$/i.test(atual.name)
        ? "Comprima o PDF (ex.: ilovepdf.com ou smallpdf.com) ou envie só as páginas necessárias."
        : "Envie uma foto menor ou em JPG.";
    return {
      erro: `"${arquivo.name}" tem ${mb(atual.size)} MB e o limite de envio é ${mb(LIMITE_UPLOAD_BYTES)} MB. ${dica}`,
    };
  }

  return { arquivo: atual };
}
