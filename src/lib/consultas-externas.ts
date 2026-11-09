"use server";

import { getUsuarioAtual } from "@/lib/auth";
import { formatarCep, montarTextoEndereco, soDigitos, type DadosCep, type DadosCnpj, type ResultadoConsulta } from "@/lib/consultas-publicas";
import { documentoFiscalValido, formatarCpfCnpj } from "@/lib/documento-fiscal";

// Consultas gratuitas de CEP (ViaCEP, com a BrasilAPI de reserva) e CNPJ (BrasilAPI, com a Minha Receita
// de reserva). Só usuário logado consulta. Esses serviços recusam ou travam pedido sem User-Agent.

const LIMITE_MS = 8000;

async function buscar(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": "SOMA-app/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(LIMITE_MS),
    cache: "no-store",
  });
}

type CepViaCep = { erro?: boolean | string; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
type CepBrasilApi = { street?: string; neighborhood?: string; city?: string; state?: string };

function dadosDoCep(cepDigitos: string, d: { logradouro?: string; bairro?: string; cidade?: string; uf?: string }): DadosCep {
  const logradouro = d.logradouro?.trim() ?? "";
  const bairro = d.bairro?.trim() ?? "";
  const cidade = d.cidade?.trim() ?? "";
  const uf = d.uf?.trim() ?? "";
  return {
    cep: formatarCep(cepDigitos),
    logradouro,
    bairro,
    cidade,
    uf,
    texto: montarTextoEndereco({ logradouro, bairro, cidade, uf, cep: cepDigitos }),
  };
}

export async function consultarCep(cep: string): Promise<ResultadoConsulta<DadosCep>> {
  await getUsuarioAtual();
  const d = soDigitos(cep);
  if (d.length !== 8) return { ok: false, erro: "O CEP tem 8 números." };

  let naoEncontrado = false;
  try {
    const r = await buscar(`https://viacep.com.br/ws/${d}/json/`);
    if (r.ok) {
      const j = (await r.json()) as CepViaCep;
      // O ViaCEP responde "erro" quando o CEP não existe: é definitivo, não vale perguntar a outro.
      if (j.erro) return { ok: false, erro: "CEP não encontrado. Confira os números ou digite o endereço." };
      return { ok: true, dados: dadosDoCep(d, { logradouro: j.logradouro, bairro: j.bairro, cidade: j.localidade, uf: j.uf }) };
    }
  } catch (erro) {
    console.error("[cep] ViaCEP falhou, tentando BrasilAPI:", erro);
  }

  try {
    const r = await buscar(`https://brasilapi.com.br/api/cep/v1/${d}`);
    if (r.ok) {
      const j = (await r.json()) as CepBrasilApi;
      return { ok: true, dados: dadosDoCep(d, { logradouro: j.street, bairro: j.neighborhood, cidade: j.city, uf: j.state }) };
    }
    if (r.status === 404) naoEncontrado = true;
  } catch (erro) {
    console.error("[cep] BrasilAPI falhou:", erro);
  }

  return naoEncontrado
    ? { ok: false, erro: "CEP não encontrado. Confira os números ou digite o endereço." }
    : { ok: false, erro: "A consulta de CEP está fora do ar agora. Digite o endereço." };
}

type CnpjBruto = {
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string;
  descricao_tipo_de_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
  email?: string | null;
};

function dadosDoCnpj(cnpjDigitos: string, b: CnpjBruto): DadosCnpj {
  // O tipo ("AVENIDA") costuma vir separado do nome da rua.
  const tipo = b.descricao_tipo_de_logradouro?.trim() ?? "";
  let logradouro = b.logradouro?.trim() ?? "";
  const jaTemOTipo = tipo && new RegExp(`\\b${tipo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(logradouro);
  if (tipo && logradouro && !jaTemOTipo) logradouro = `${tipo} ${logradouro}`;

  const situacao = (b.descricao_situacao_cadastral ?? "").trim().toUpperCase() || "DESCONHECIDA";
  const tel = soDigitos(b.ddd_telefone_1 ?? "");
  return {
    cnpj: formatarCpfCnpj(cnpjDigitos),
    // MEI vem como "NOME ***12345***" (CPF mascarado): o número não é parte do nome.
    razaoSocial: (b.razao_social ?? "").replace(/\s*\*{3}\d*\*{3}/g, "").trim(),
    nomeFantasia: b.nome_fantasia?.trim() || null,
    situacao,
    ativa: situacao === "ATIVA",
    endereco: montarTextoEndereco({
      logradouro,
      numero: b.numero ?? "",
      complemento: b.complemento,
      bairro: b.bairro,
      cidade: b.municipio,
      uf: b.uf,
      cep: b.cep,
    }),
    telefone: tel.length >= 10 ? tel : null,
    email: b.email?.trim().toLowerCase() || null,
  };
}

export async function consultarCnpj(cnpj: string): Promise<ResultadoConsulta<DadosCnpj>> {
  await getUsuarioAtual();
  const d = soDigitos(cnpj);
  if (d.length !== 14 || !documentoFiscalValido(d)) return { ok: false, erro: "CNPJ inválido. Confira os números." };

  let limite = false;
  const fontes = [`https://brasilapi.com.br/api/cnpj/v1/${d}`, `https://minhareceita.org/${d}`];
  for (const url of fontes) {
    try {
      const r = await buscar(url);
      if (r.ok) {
        const b = (await r.json()) as CnpjBruto;
        if (!b.razao_social) continue;
        return { ok: true, dados: dadosDoCnpj(d, b) };
      }
      if (r.status === 404) return { ok: false, erro: "CNPJ não encontrado na Receita Federal." };
      if (r.status === 429) limite = true;
    } catch (erro) {
      console.error(`[cnpj] ${new URL(url).host} falhou:`, erro);
    }
  }

  return {
    ok: false,
    erro: limite
      ? "Muitas consultas seguidas. Espere um minuto e tente de novo."
      : "A consulta de CNPJ está fora do ar agora. Preencha os dados à mão.",
  };
}
