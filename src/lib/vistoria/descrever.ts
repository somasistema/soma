// Sugere a descrição de um ambiente do Termo de Vistoria a partir das fotos.
// Só sugere: a equipe confere e ajusta antes de gerar o PDF. Sem ANTHROPIC_API_KEY
// (ou se a chamada falhar), devolve null e a descrição fica pra ser digitada.

const MODELO = "claude-sonnet-5-5";
const MAX_FOTOS = 8;
const LADO_MAXIMO = 1600;

const PROMPT = (ambiente: string) => `Você ajuda uma assessoria imobiliária a redigir o Termo de Vistoria de um imóvel alugado.
Descreva o estado do ambiente "${ambiente}" com base SOMENTE nas fotos enviadas.

Formato: itens em linhas separadas, com letras (a), b), c)...), neste estilo:
a) Piso: revestido em cerâmica clara, em bom estado, com desgaste natural de uso.
b) Paredes: pintura lisa branca, em bom estado aparente, com pequenas marcas compatíveis com o uso.
c) Teto: ...
d) Porta/Janela: quantidade, material, tipo e estado de conservação e funcionamento aparente.
e) Contém: móveis, eletrodomésticos, armários e equipamentos que aparecem (com marca/modelo/tamanho só se estiver legível na foto).
f) Observação: avarias, manchas, rachaduras, infiltração ou itens quebrados que sejam visíveis.

Regras:
- Descreva apenas o que se vê. Não invente nem suponha; se um item (teto, janela etc.) não aparece nas fotos, omita-o.
- Use linguagem objetiva e neutra de laudo ("em bom estado aparente", "com desgaste natural de uso", "com mancha de umidade").
- Cite avarias com precisão (onde e como), pois o locatário assina sobre isso.
- Responda só com os itens, sem introdução nem conclusão.`;

export async function descreverAmbienteComIA(
  nomeAmbiente: string,
  fotos: Buffer[]
): Promise<{ texto: string } | { erro: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { erro: "A leitura por IA não está configurada (ANTHROPIC_API_KEY)." };
  }
  if (fotos.length === 0) return { erro: "Envie ao menos uma foto do ambiente." };

  try {
    const sharp = (await import("sharp")).default;
    const imagens = await Promise.all(
      fotos.slice(0, MAX_FOTOS).map(async (foto) => {
        const jpeg = await sharp(foto)
          .rotate()
          .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
          .flatten({ background: "#ffffff" })
          .jpeg({ quality: 80 })
          .toBuffer();
        return {
          type: "image" as const,
          source: { type: "base64" as const, media_type: "image/jpeg" as const, data: jpeg.toString("base64") },
        };
      })
    );

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    // Sonnet pensa antes de responder: a folga em max_tokens evita cortar a resposta.
    const resposta = await client.messages.create({
      model: MODELO,
      max_tokens: 4000,
      messages: [{ role: "user", content: [...imagens, { type: "text", text: PROMPT(nomeAmbiente) }] }],
    });
    const texto = resposta.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!texto) return { erro: "A IA não devolveu descrição. Tente de novo ou escreva à mão." };
    return { texto };
  } catch (erro) {
    console.error("[vistoria] falha ao descrever o ambiente:", erro);
    return { erro: "Não foi possível descrever pelas fotos agora. Escreva à mão ou tente de novo." };
  }
}
