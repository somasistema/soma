// Compara nomes de pessoa ignorando acento, caixa e partículas ("de", "da", "dos"...).
// Serve pra ligar o titular de um documento (como impresso: "MARIA APARECIDA SANTOS DA SILVA")
// à pessoa cadastrada no processo ("Maria Aparecida da Silva Santos").

const PARTICULAS = new Set(["de", "da", "do", "dos", "das", "e"]);

function palavras(nome: string): string[] {
  return nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 1 && !PARTICULAS.has(p));
}

// Mesma pessoa: começa pelo mesmo primeiro nome e divide ao menos mais uma palavra; ou divide três
// ou mais palavras (ordem trocada, nome de casada...). Só sobrenome em comum não basta — marido e
// mulher quase sempre dividem sobrenome.
export function mesmaPessoa(a: string, b: string): boolean {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.length === 0 || pb.length === 0) return false;
  const comuns = pa.filter((p) => pb.includes(p)).length;
  if (pa[0] === pb[0] && comuns >= 2) return true;
  return comuns >= 3;
}
