// Trocas pontuais num modelo de contrato (sugeridas pela IA em modelo-ia.ts e escolhidas na tela).
// Fica separado de modelo-ia.ts porque a tela (navegador) aplica as trocas; a chamada à IA é só do servidor.

export type EdicaoModelo = {
  tipo: "substituir" | "inserir_apos" | "remover";
  trecho: string; // exatamente como está no texto
  novo: string; // texto novo (vazio em "remover")
  todas: boolean; // troca todas as ocorrências (senão só a primeira)
  motivo: string;
  ocorrencias: number; // quantas vezes o trecho aparece no texto
};

export type SugestoesModelo = { edicoes: EdicaoModelo[]; avisos: string[] };

// Aplica as edições escolhidas, em ordem. Trecho que uma troca anterior já consumiu é ignorado.
export function aplicarEdicoesModelo(texto: string, edicoes: EdicaoModelo[]): { texto: string; aplicadas: number } {
  let atual = texto;
  let aplicadas = 0;
  for (const e of edicoes) {
    if (!atual.includes(e.trecho)) continue;
    if (e.tipo === "substituir") {
      atual = e.todas ? atual.split(e.trecho).join(e.novo) : atual.replace(e.trecho, () => e.novo);
    } else if (e.tipo === "inserir_apos") {
      atual = e.todas
        ? atual.split(e.trecho).join(e.trecho + e.novo)
        : atual.replace(e.trecho, () => e.trecho + e.novo);
    } else {
      atual = e.todas ? atual.split(e.trecho).join("") : atual.replace(e.trecho, () => "");
    }
    aplicadas++;
  }
  return { texto: atual, aplicadas };
}
