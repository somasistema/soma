// PDF único com vários documentos (RG de um, RG do cônjuge, certidão de casamento, comprovante...).
// A leitura normal olha só a primeira página e atribui tudo a quem recebeu o anexo. Aqui o PDF é
// separado: cada página vira imagem, a IA agrupa as páginas por documento e diz o tipo e o titular, e
// cada documento sai num PDF próprio, pra seguir o mesmo caminho de um anexo avulso.
import type { CategoriaDocIntake } from "@/types/database";

export const MAX_PAGINAS_LOTE = 12;

export type DocumentoSegmentado = {
  paginas: number[]; // 1-based, na ordem
  categoria: CategoriaDocIntake | "outro";
  titulares: string[];
};

const CATEGORIAS_VALIDAS: (CategoriaDocIntake | "outro")[] = [
  "identidade",
  "estado_civil",
  "comprovante_residencia",
  "uniao_estavel",
  "contrato_social",
  "certidoes",
  "outro",
];

const MODELO = "claude-sonnet-5-5";

// Cada página vira um JPEG pequeno (a IA só precisa ver o que é e de quem). Devolve também o total.
export async function renderizarPaginas(
  buffer: Buffer,
  max = MAX_PAGINAS_LOTE
): Promise<{ total: number; imagens: Buffer[] }> {
  const mupdf = await import("mupdf");
  const sharp = (await import("sharp")).default;
  const doc = mupdf.Document.openDocument(buffer, "application/pdf");
  try {
    const total = doc.countPages();
    const imagens: Buffer[] = [];
    for (let i = 0; i < Math.min(total, max); i++) {
      const page = doc.loadPage(i);
      try {
        const pix = page.toPixmap(mupdf.Matrix.scale(1.5, 1.5), mupdf.ColorSpace.DeviceRGB, false, true);
        try {
          const jpeg = await sharp(Buffer.from(pix.asPNG()))
            .resize({ width: 1100, height: 1500, fit: "inside", withoutEnlargement: true })
            .flatten({ background: "#ffffff" })
            .jpeg({ quality: 72 })
            .toBuffer();
          imagens.push(jpeg);
        } finally {
          pix.destroy?.();
        }
      } finally {
        page.destroy?.();
      }
    }
    return { total, imagens };
  } finally {
    doc.destroy?.();
  }
}

const FERRAMENTA = {
  name: "reportar_documentos",
  description: "Reporta como as páginas do PDF se agrupam em documentos.",
  input_schema: {
    type: "object" as const,
    properties: {
      documentos: {
        type: "array",
        description: "Um item por documento, na ordem em que aparecem. Toda página entra em exatamente um documento.",
        items: {
          type: "object",
          properties: {
            paginas: {
              type: "array",
              items: { type: "integer" },
              description: "Números das páginas (a 1ª página do PDF é 1) que formam este documento.",
            },
            categoria: {
              type: "string",
              enum: CATEGORIAS_VALIDAS,
              description:
                "identidade = RG, CNH, passaporte, carteira funcional/OAB (frente e verso são UM documento); estado_civil = certidão de casamento, nascimento, divórcio ou óbito; uniao_estavel = declaração ou escritura de união estável; comprovante_residencia = conta de luz, água, telefone, fatura, boleto, declaração de residência; contrato_social = contrato social, alteração contratual, certidão simplificada da Junta; certidoes = certidões negativas de empresa; outro = capa, página em branco, procuração, qualquer coisa fora dessas.",
            },
            titulares: {
              type: "array",
              items: { type: "string" },
              description:
                "Nome completo, como impresso, de quem o documento pertence. Identidade: uma pessoa. Certidão de casamento: os dois cônjuges. Comprovante: o titular da conta. Vazio se não houver nome legível.",
            },
          },
          required: ["paginas", "categoria", "titulares"],
        },
      },
    },
    required: ["documentos"],
  },
};

export async function segmentarComIA(imagens: Buffer[]): Promise<DocumentoSegmentado[] | null> {
  if (!process.env.ANTHROPIC_API_KEY || imagens.length === 0) return null;
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const conteudo: Parameters<typeof client.messages.create>[0]["messages"][number]["content"] = [];
    imagens.forEach((img, i) => {
      conteudo.push({ type: "text", text: `Página ${i + 1}:` });
      conteudo.push({
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: img.toString("base64") },
      });
    });
    conteudo.push({
      type: "text",
      text:
        "Este PDF reúne, num só arquivo, documentos de pessoas de um processo imobiliário (RG/CNH, certidão de casamento ou nascimento, comprovante de residência, declaração de união estável, contrato social...). " +
        "Agrupe as páginas por documento (páginas seguidas do mesmo documento ficam juntas; frente e verso de RG/CNH são um documento só) e chame a ferramenta reportar_documentos. " +
        "Não invente: se não conseguir ler o nome do titular, deixe a lista vazia.",
    });

    // O modelo maior pensa antes de responder: folga em max_tokens (senão corta a resposta).
    const resposta = await client.messages.create({
      model: MODELO,
      max_tokens: 8000,
      tools: [FERRAMENTA],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: conteudo }],
    });

    const uso = resposta.content.find((b) => b.type === "tool_use");
    if (!uso || uso.type !== "tool_use") return null;
    const bruto = (uso.input as { documentos?: unknown }).documentos;
    if (!Array.isArray(bruto)) return null;

    const total = imagens.length;
    const vistas = new Set<number>();
    const docs: DocumentoSegmentado[] = [];
    for (const d of bruto as { paginas?: unknown; categoria?: unknown; titulares?: unknown }[]) {
      const paginas = (Array.isArray(d.paginas) ? d.paginas : [])
        .map(Number)
        .filter((p) => Number.isInteger(p) && p >= 1 && p <= total && !vistas.has(p))
        .sort((a, b) => a - b);
      if (paginas.length === 0) continue;
      paginas.forEach((p) => vistas.add(p));
      const categoria = CATEGORIAS_VALIDAS.includes(d.categoria as CategoriaDocIntake)
        ? (d.categoria as CategoriaDocIntake | "outro")
        : "outro";
      const titulares = (Array.isArray(d.titulares) ? d.titulares : [])
        .map((n) => String(n).trim())
        .filter(Boolean);
      docs.push({ paginas, categoria, titulares });
    }
    // Página que a IA esqueceu não some: vira um documento "outro" (aparece no aviso).
    for (let p = 1; p <= total; p++) {
      if (!vistas.has(p)) docs.push({ paginas: [p], categoria: "outro", titulares: [] });
    }
    return docs;
  } catch (erro) {
    console.error("[pdf-lote] falha ao separar os documentos:", erro);
    return null;
  }
}

// Novo PDF só com as páginas pedidas (1-based).
export async function extrairPaginas(buffer: Buffer, paginas: number[]): Promise<Buffer> {
  const mupdf = await import("mupdf");
  const origem = mupdf.Document.openDocument(buffer, "application/pdf");
  try {
    const src = origem.asPDF();
    if (!src) throw new Error("não é um PDF");
    const saida = new mupdf.PDFDocument();
    try {
      for (const p of paginas) saida.graftPage(-1, src, p - 1);
      return Buffer.from(saida.saveToBuffer("compress").asUint8Array());
    } finally {
      saida.destroy?.();
    }
  } finally {
    origem.destroy?.();
  }
}
