// Tipos e formatadores das consultas de CEP e CNPJ. Sem fetch nem segredo: pode ir pro navegador.
// As consultas em si ficam em consultas-externas.ts (servidor).

export type ResultadoConsulta<T> = { ok: true; dados: T } | { ok: false; erro: string };

export type DadosCep = {
  cep: string; // 00000-000
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  // "Rua X, bairro, Cidade/UF, CEP 00000-000": falta o número, que a pessoa completa.
  texto: string;
};

export type DadosCnpj = {
  cnpj: string; // 00.000.000/0000-00
  razaoSocial: string;
  nomeFantasia: string | null;
  situacao: string; // ATIVA, BAIXADA, INAPTA...
  ativa: boolean;
  endereco: string;
  telefone: string | null; // só dígitos, com DDD
  email: string | null;
};

export type DadosCpf = {
  cpf: string; // 000.000.000-00
  nome: string;
  nascimento: string | null; // AAAA-MM-DD, pronto para <input type="date">
};

export const soDigitos =(v: string) => v.replace(/\D/g, "");

export function formatarCep(valor: string): string {
  const d = soDigitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "em", "na", "no", "nas", "nos"]);

// A Receita devolve endereço em CAIXA ALTA. "AVENIDA SETE DE SETEMBRO" -> "Avenida Sete de Setembro".
const ROMANO = /^(?:I{1,3}|IV|VI{0,3}|IX|X)[,.;]?$/i; // I a X: "Torre II", "Bloco IV"

export function tituloEndereco(texto: string): string {
  return texto
    .split(/\s+/)
    .filter(Boolean)
    .map((original, i) => {
      if (ROMANO.test(original)) return original.toUpperCase();
      const p = original.toLowerCase();
      return i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(" ");
}

export function montarTextoEndereco(p: {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}): string {
  const partes: string[] = [];
  const temRua = Boolean(p.logradouro?.trim());
  if (temRua) partes.push(tituloEndereco(p.logradouro!.trim()));
  // Sem rua, "s/n" no começo do endereço não quer dizer nada.
  if (temRua && p.numero !== undefined) {
    const n = (p.numero ?? "").trim();
    partes.push(!n || /^s\/?n$/i.test(n) ? "s/n" : n);
  }
  if (p.complemento?.trim()) partes.push(tituloEndereco(p.complemento.trim()));
  if (p.bairro?.trim()) partes.push(tituloEndereco(p.bairro.trim()));
  const cidade = p.cidade?.trim() ? tituloEndereco(p.cidade.trim()) : "";
  const uf = p.uf?.trim().toUpperCase() ?? "";
  if (cidade || uf) partes.push([cidade, uf].filter(Boolean).join("/"));
  if (p.cep && soDigitos(p.cep).length === 8) partes.push(`CEP ${formatarCep(p.cep)}`);
  return partes.join(", ");
}
