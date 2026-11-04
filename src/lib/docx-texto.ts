// Texto de um arquivo Word (.docx) — pra importar um modelo de contrato. O .docx é um zip; o texto
// está em word/document.xml. Cada parágrafo do Word vira um parágrafo do modelo (linha em branco
// entre eles); quebra de linha dentro do parágrafo (Shift+Enter) vira quebra de linha. Formatação
// (negrito, cor, tabela) não é levada: o contrato aplica o formato padrão da SOMA.
import { strFromU8, unzipSync } from "fflate";

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function desescapar(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const cod = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cod) ? String.fromCodePoint(cod) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

export function docxParaTexto(dados: Uint8Array): string {
  const zip = unzipSync(dados);
  const xmlBruto = zip["word/document.xml"];
  if (!xmlBruto) throw new Error("Não é um arquivo Word (.docx) válido.");
  const xml = strFromU8(xmlBruto);

  const paragrafos = xml
    .split(/<\/w:p>/)
    .map((p) =>
      desescapar(
        p
          .replace(/<w:tab\/>/g, "\t")
          .replace(/<w:br[^>]*\/>/g, "\n")
          .replace(/<[^>]+>/g, "")
      )
        .replace(/[ \t]+\n/g, "\n")
        .trim()
    )
    .filter(Boolean);

  return paragrafos.join("\n\n");
}
