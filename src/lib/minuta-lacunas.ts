// Trechos da minuta que ainda são "lacuna" do modelo (nada veio dos dados
// do processo): XXXX, 0000, 000.000,00, 0º, ____ e [DADOS DO IMÓVEL].
// A tela pinta de vermelho pra ninguém esquecer de preencher; some sozinho
// quando o texto é corrigido. Não é gravado na minuta nem vai pro PDF.
//
// Números normais (5.000,00 / 2026 / 100) não casam: um zero só vale se
// não vier colado em outro dígito.
export const LACUNA = /\[[^\]\n]{3,}\]|[Xx]{2,}|_{3,}|\b0º|(?<!\d[.,]?)0{2,}(?:[.,\-]0+)*(?![\d])/g;

export type Trecho = { texto: string; lacuna: boolean };

export function dividirLacunas(texto: string): Trecho[] {
  const trechos: Trecho[] = [];
  let ultimo = 0;
  for (const m of texto.matchAll(LACUNA)) {
    const i = m.index ?? 0;
    if (i > ultimo) trechos.push({ texto: texto.slice(ultimo, i), lacuna: false });
    trechos.push({ texto: m[0], lacuna: true });
    ultimo = i + m[0].length;
  }
  if (ultimo < texto.length) trechos.push({ texto: texto.slice(ultimo), lacuna: false });
  return trechos;
}
