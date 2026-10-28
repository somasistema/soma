// Foto de documento tirada no celular chega girada (de cabeça pra baixo, de lado)
// e grande demais. O Tesseract e a IA leem lixo nessas fotos, então a imagem é
// normalizada antes: aplica a orientação gravada no arquivo (EXIF), limita o
// tamanho e salva em JPEG. Se a leitura ainda sai com pouca confiança, extrair.ts
// tenta girar 180/90/270 graus e fica com a posição que o OCR leu melhor.
//
// O sharp já vem com o Next. Se ele falhar por qualquer motivo, devolve a
// imagem original sem quebrar a leitura.

const LADO_MAXIMO = 2400;
const QUALIDADE_JPEG = 90;

export type ImagemNormalizada = { dados: Buffer; mimeType: string };

async function carregarSharp() {
  const mod = await import("sharp");
  return mod.default;
}

export async function normalizarImagem(
  buffer: Buffer,
  mimeOriginal: string | null
): Promise<ImagemNormalizada> {
  try {
    const sharp = await carregarSharp();
    const dados = await sharp(buffer)
      .rotate() // aplica a orientação EXIF e limpa o marcador
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" }) // PNG com transparência vira fundo branco
      .jpeg({ quality: QUALIDADE_JPEG })
      .toBuffer();
    return { dados, mimeType: "image/jpeg" };
  } catch (erro) {
    console.error("[ocr] falha ao normalizar a imagem, usando original:", erro);
    return { dados: buffer, mimeType: mimeOriginal || "image/jpeg" };
  }
}

// Pergunta à IA de visão pra onde aponta o topo do texto e converte no giro
// (sentido horário) que deixa a foto na posição normal de leitura. Perguntar a
// direção do topo é mais confiável que perguntar graus (a IA confunde horário
// com anti-horário). O Tesseract não serve pra isso: em foto de CNH com fundo de
// segurança ele "lê" palavras em qualquer posição, com confiança parecida.
// Retorna null se não houver chave da API ou a chamada falhar.
//
// Sonnet, e não Haiku: o Haiku erra a orientação de foto girada. O Sonnet pensa
// antes de responder, então precisa de folga em max_tokens (senão corta a resposta).
const MODELO_ORIENTACAO = "claude-sonnet-5-5";

const GIRO_POR_TOPO = { cima: 0, direita: 270, baixo: 180, esquerda: 90 } as const;

export async function detectarGiroComIA(imagem: ImagemNormalizada): Promise<0 | 90 | 180 | 270 | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const resposta = await client.messages.create({
      model: MODELO_ORIENTACAO,
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imagem.dados.toString("base64") },
            },
            {
              type: "text",
              text: "Esta é a foto de um documento brasileiro. O texto impresso está em pé (normal), de cabeça para baixo, ou tombado para um dos lados? Responda em UMA linha no formato: TOPO=cima|baixo|esquerda|direita (a borda da imagem para onde apontam os topos das letras).",
            },
          ],
        },
      ],
    });
    const texto = resposta.content.map((b) => (b.type === "text" ? b.text : "")).join(" ");
    const topo = texto.match(/TOPO\s*=\s*(cima|baixo|esquerda|direita)/i)?.[1]?.toLowerCase();
    return topo ? GIRO_POR_TOPO[topo as keyof typeof GIRO_POR_TOPO] : null;
  } catch (erro) {
    console.error("[ocr] falha ao detectar a orientação por IA:", erro);
    return null;
  }
}

export async function girarImagem(imagem: ImagemNormalizada, graus: 90 | 180 | 270): Promise<ImagemNormalizada> {
  try {
    const sharp = await carregarSharp();
    const dados = await sharp(imagem.dados).rotate(graus).jpeg({ quality: QUALIDADE_JPEG }).toBuffer();
    return { dados, mimeType: "image/jpeg" };
  } catch (erro) {
    console.error("[ocr] falha ao girar a imagem:", erro);
    return imagem;
  }
}
