import type { TipoDocumentoOcr } from "@/types/database";

export type CampoLido = { nm_campo: string; ds_valor: string; nr_confianca: number };

const DIACRITICOS = /[̀-ͯ]/g;
const norm = (s: string) => s.normalize("NFD").replace(DIACRITICOS, "").toLowerCase();

// ---- validadores ---------------------------------------------------

function digitos(s: string) {
  return s.replace(/\D/g, "");
}

export function cpfValido(bruto: string) {
  const n = digitos(bruto);
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  const dv = (base: number) => {
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(n[i]) * (base + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(9) === Number(n[9]) && dv(10) === Number(n[10]);
}

export function cnpjValido(bruto: string) {
  const n = digitos(bruto);
  if (n.length !== 14 || /^(\d)\1{13}$/.test(n)) return false;
  const calc = (base: number) => {
    const pesos =
      base === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < base; i++) soma += Number(n[i]) * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return calc(12) === Number(n[12]) && calc(13) === Number(n[13]);
}

// ---- helpers -----------------------------------------------------

function fmtCpf(n: string) {
  const d = digitos(n);
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtCnpj(n: string) {
  const d = digitos(n);
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function fmtCep(n: string) {
  const d = digitos(n);
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// Pega o texto logo depois de um rótulo, na mesma linha ou na de baixo.
function aposRotulo(texto: string, rotulos: string[], maxLen = 60): string | null {
  const linhas = texto.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const linhaNorm = norm(linhas[i]);
    for (const rotulo of rotulos) {
      const pos = linhaNorm.indexOf(norm(rotulo));
      if (pos === -1) continue;
      const resto = linhas[i].slice(pos + rotulo.length).replace(/^[\s:.\-—]+/, "").trim();
      if (resto.length >= 3) return resto.slice(0, maxLen);
      const abaixo = (linhas[i + 1] ?? "").trim();
      if (abaixo.length >= 3) return abaixo.slice(0, maxLen);
    }
  }
  return null;
}

function soNomePessoa(s: string): string | null {
  const limpo = s
    .replace(/[^A-Za-zÀ-ÿ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const palavras = limpo.split(" ").filter((p) => p.length >= 2);
  if (palavras.length < 2 || palavras.length > 8) return null;
  return palavras.join(" ").toUpperCase();
}

// ---- parsers genéricos (rodam em qualquer documento) --------------

function acharCpf(texto: string): CampoLido | null {
  const candidatos = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g) ?? [];
  for (const c of candidatos) {
    if (cpfValido(c)) return { nm_campo: "cpf", ds_valor: fmtCpf(c), nr_confianca: 95 };
  }
  return null;
}

function acharCnpj(texto: string): CampoLido | null {
  const candidatos = texto.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g) ?? [];
  for (const c of candidatos) {
    if (cnpjValido(c)) return { nm_campo: "cnpj", ds_valor: fmtCnpj(c), nr_confianca: 95 };
  }
  return null;
}

function acharCep(texto: string): CampoLido | null {
  const m = texto.match(/\b\d{5}-?\d{3}\b/);
  if (!m) return null;
  return { nm_campo: "cep", ds_valor: fmtCep(m[0]), nr_confianca: 80 };
}

function acharDataNascimento(texto: string): CampoLido | null {
  const alvo = aposRotulo(texto, ["data de nascimento", "nascimento", "data nasc", "dt nasc"]);
  const m = (alvo ?? "").match(/\d{2}[/.\-]\d{2}[/.\-]\d{4}/);
  if (!m) return null;
  return {
    nm_campo: "data_nascimento",
    ds_valor: m[0].replace(/[.\-]/g, "/"),
    nr_confianca: 75,
  };
}

function acharNome(texto: string): CampoLido | null {
  const bruto = aposRotulo(texto, ["nome completo", "nome", "name"]);
  const nome = bruto ? soNomePessoa(bruto) : null;
  if (!nome) return null;
  return { nm_campo: "nome", ds_valor: nome, nr_confianca: 60 };
}

function acharNomeMae(texto: string): CampoLido | null {
  const bruto = aposRotulo(texto, ["filiacao", "nome da mae", "mae"]);
  const nome = bruto ? soNomePessoa(bruto) : null;
  if (!nome) return null;
  return { nm_campo: "nome_mae", ds_valor: nome, nr_confianca: 55 };
}

function acharEndereco(texto: string): CampoLido | null {
  const bruto = aposRotulo(
    texto,
    ["endereco", "logradouro", "end.", "rua", "avenida", "av."],
    120
  );
  if (!bruto || bruto.length < 6) return null;
  return { nm_campo: "endereco", ds_valor: bruto, nr_confianca: 50 };
}

// ---- parsers específicos ----------------------------------------

function parseRg(texto: string): CampoLido[] {
  const out: CampoLido[] = [];
  const alvo =
    aposRotulo(texto, ["registro geral", "rg no", "rg:", "identidade", "no registro"]) ?? texto;
  const m = alvo.match(/\d{1,2}\.?\d{3}\.?\d{3}-?[\dxX]/);
  if (m) out.push({ nm_campo: "rg", ds_valor: m[0].toUpperCase(), nr_confianca: 80 });
  const pai = aposRotulo(texto, ["nome do pai"]);
  const nomePai = pai ? soNomePessoa(pai) : null;
  if (nomePai) out.push({ nm_campo: "nome_pai", ds_valor: nomePai, nr_confianca: 55 });
  return out;
}

function parseCnh(texto: string): CampoLido[] {
  const out: CampoLido[] = [];
  const alvo = aposRotulo(texto, ["no registro", "registro", "n registro"]) ?? "";
  const m = alvo.match(/\b\d{9,11}\b/);
  if (m) out.push({ nm_campo: "cnh_registro", ds_valor: m[0], nr_confianca: 75 });
  return out;
}

function parseMatricula(texto: string): CampoLido[] {
  const out: CampoLido[] = [];
  const m = texto.match(/matr[ií]cula\s*(?:n[º°.]?\s*)?([\d.]{3,})/i);
  if (m) {
    out.push({
      nm_campo: "matricula",
      ds_valor: m[1].replace(/\.$/, ""),
      nr_confianca: 85,
    });
  }
  const cart = aposRotulo(texto, [
    "cartorio",
    "oficio de registro de imoveis",
    "registro de imoveis",
    "servico registral",
  ]);
  if (cart && cart.length >= 6) {
    out.push({ nm_campo: "cartorio", ds_valor: cart, nr_confianca: 55 });
  }
  return out;
}

function parseContratoSocial(texto: string): CampoLido[] {
  const out: CampoLido[] = [];
  const razao = aposRotulo(texto, ["razao social", "denominacao social", "nome empresarial"], 120);
  if (razao && razao.length >= 4) {
    out.push({ nm_campo: "razao_social", ds_valor: razao.toUpperCase(), nr_confianca: 60 });
  }
  return out;
}

const ESPECIFICOS: Partial<Record<TipoDocumentoOcr, (t: string) => CampoLido[]>> = {
  rg: parseRg,
  cnh: parseCnh,
  matricula_imovel: parseMatricula,
  contrato_social: parseContratoSocial,
};

// Roda os parsers genéricos + o específico do tipo detectado e devolve
// no máximo um valor por campo (o de maior confiança).
export function extrairCampos(tipo: TipoDocumentoOcr, texto: string): CampoLido[] {
  const genericos = [
    acharCpf,
    acharCnpj,
    acharCep,
    acharDataNascimento,
    acharNome,
    acharNomeMae,
    acharEndereco,
  ];

  const brutos: CampoLido[] = [];
  for (const fn of genericos) {
    const r = fn(texto);
    if (r) brutos.push(r);
  }
  const especifico = ESPECIFICOS[tipo];
  if (especifico) brutos.push(...especifico(texto));

  const melhorPorCampo = new Map<string, CampoLido>();
  for (const campo of brutos) {
    const atual = melhorPorCampo.get(campo.nm_campo);
    if (!atual || campo.nr_confianca > atual.nr_confianca) {
      melhorPorCampo.set(campo.nm_campo, campo);
    }
  }
  return [...melhorPorCampo.values()];
}
