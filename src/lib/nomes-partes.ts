type ParteNome = { nm_parte: string; tp_lado: string };

// Empresa mantém o nome inteiro ("SPE RESIDENCIAL"); pessoa vira só o primeiro nome.
const EMPRESA = /\b(ltda|spe|s\.?\s?a\.?|eireli|epp|empreendimentos?|construtora|incorporadora|residencial|imobili[aá]ria|condom[ií]nio|empresa|cia)\b/i;

function primeiroNome(nome: string): string {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (!limpo || EMPRESA.test(limpo)) return limpo;
  return limpo.split(" ")[0];
}

function lista(nomes: string[]): string {
  return nomes.map(primeiroNome).filter(Boolean).join(" E ").toUpperCase();
}

// "JOÃO E MARIA X CLAUDIO E MÔNICA": mesmo padrão com que a equipe nomeia as pastas do Drive.
// Espera as partes já na ordem de cadastro.
export function tituloDasPartes(partes: ParteNome[]): string {
  const vendedores = lista(partes.filter((p) => p.tp_lado === "vendedor").map((p) => p.nm_parte));
  const compradores = lista(partes.filter((p) => p.tp_lado === "comprador").map((p) => p.nm_parte));
  if (vendedores && compradores) return `${vendedores} X ${compradores}`;
  return vendedores || compradores;
}
