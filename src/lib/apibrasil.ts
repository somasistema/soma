import type { ResultadoConsultaPaga, TipoConsultaPaga } from "@/lib/consultas-pagas";

// Cliente da APIBrasil (gateway.apibrasil.io) para as consultas pagas: certidão federal (conjunta PF/PJ),
// certidão estadual e protesto. Só roda no servidor. Cada chamada real cobra do saldo, então:
//   - nunca repete sozinha (nem em erro de rede: a cobrança pode ter acontecido);
//   - erro pode vir com HTTP 200: confere `error` antes de ler `data`;
//   - APIBRASIL_HOMOLOG=true usa a base de teste do fornecedor (não cobra, dados fictícios).

const GATEWAY = "https://gateway.apibrasil.io/api/v2/consulta";
const LIMITE_MS = 45000;

export type ConsultaNormalizada = {
  resultado: ResultadoConsultaPaga;
  resumo: string;
  validade: string | null; // AAAA-MM-DD
  dados: Record<string, unknown>;
  custo: number | null;
  homologacao: boolean;
};

export type RespostaApiBrasil = { ok: true; consulta: ConsultaNormalizada } | { ok: false; erro: string };

type Bruta = {
  error?: boolean;
  message?: string;
  homolog?: boolean;
  valor_consulta?: number | string;
  data?: Record<string, unknown>;
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// "13/10/2026" ou "13/10/2026 14:08:25" -> "2026-10-13"
function dataBrParaIso(v: unknown): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto(v));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function numero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const t = texto(v).replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return t && Number.isFinite(n) ? n : null;
}

const real = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function normalizarFederal(d: Record<string, unknown>): Omit<ConsultaNormalizada, "custo" | "homologacao"> {
  const status = texto(d.status).toUpperCase();
  const titulo = texto(d.titulo);
  const dividas = lista(d.listaDividas).map((x) => texto(x).slice(0, 300)).filter(Boolean);
  const pendencias = numero(d.totalPendencias) ?? 0;
  let resultado: ResultadoConsultaPaga = "desconhecido";
  let resumo = "Resultado não reconhecido: confira os dados.";
  if (status === "NADA CONSTA") {
    resultado = "negativa";
    resumo = "Certidão negativa de débitos federais e dívida ativa da União.";
  } else if (/POSITIVA COM EFEITOS/i.test(titulo)) {
    resultado = "com_efeitos";
    resumo = "Positiva com efeitos de negativa: há débitos federais com exigibilidade suspensa ou não vencidos.";
  } else if (status === "CONSTA" || d.possuiDividas === true || d.possuiPendencias === true) {
    resultado = "positiva";
    resumo = pendencias > 0 ? `Constam débitos federais (${pendencias} pendência(s)).` : "Constam débitos federais.";
  }
  return {
    resultado,
    resumo,
    validade: dataBrParaIso(d.validaAte),
    dados: { status, titulo, codigoControle: texto(d.codigoControleCertidao), totalPendencias: pendencias, listaDividas: dividas.slice(0, 5) },
  };
}

// Resumo da forma da resposta (chaves e valores curtos, sem nome nem documento) para diagnosticar
// um resultado que o sistema não soube ler, sem guardar dado pessoal.
function formatoDaResposta(v: unknown, profundidade = 0): unknown {
  if (Array.isArray(v)) return v.length === 0 ? [] : [formatoDaResposta(v[0], profundidade + 1), `(${v.length} itens)`];
  if (v && typeof v === "object") {
    if (profundidade > 3) return "{...}";
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [
        k,
        /nome|cpf|cnpj|documento|endereco|logradouro|email|telefone/i.test(k)
          ? typeof x
          : typeof x === "string"
            ? x.slice(0, 80)
            : formatoDaResposta(x, profundidade + 1),
      ])
    );
  }
  return v;
}

function normalizarEstadual(d: Record<string, unknown>): Omit<ConsultaNormalizada, "custo" | "homologacao"> {
  // A resposta real pode vir em "retorno", "dados" ou direto em "data".
  const pega = (x: unknown) => (x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
  const r = pega(d.retorno) ?? pega(d.dados) ?? d;
  const debitos = lista(r.debitos);
  const possui = r.possuiDebito ?? r.possui_debito ?? r.possuiDebitos;
  const status = texto(r.status) || texto(r.situacao);
  const observacao = texto(r.observacao) || texto(r.mensagem) || texto(d.mensagem);
  let resultado: ResultadoConsultaPaga = "desconhecido";
  let resumo = "";
  if (possui === false || (possui == null && /negativa|nada consta|n[ãa]o constam/i.test(status))) {
    resultado = "negativa";
    resumo = "Certidão negativa de débitos estaduais.";
  } else if (possui === true || debitos.length > 0 || (possui == null && /positiva|constam d[ée]bitos|com d[ée]bitos/i.test(status))) {
    resultado = "positiva";
    resumo = debitos.length > 0 ? `Constam débitos estaduais (${debitos.length}).` : "Constam débitos estaduais.";
  } else {
    const motivo = [status, observacao].filter(Boolean).join(" — ").slice(0, 280);
    resumo = motivo ? `Não foi possível concluir: ${motivo}` : "A Sefaz não devolveu um resultado conclusivo. Confira no site da Sefaz-BA.";
    console.error("[apibrasil] estadual sem resultado reconhecido:", JSON.stringify(formatoDaResposta(d)).slice(0, 1500));
  }
  return {
    resultado,
    resumo,
    validade: dataBrParaIso(r.dataValidade ?? r.data_validade),
    dados: {
      status,
      numeroCertidao: texto(r.numeroCertidao) || texto(r.numero_certidao),
      codigoValidacao: texto(r.codigoValidacao) || texto(r.codigo_validacao),
      efeitoNegativa: r.efeitoNegativa ?? null,
      observacao: observacao.slice(0, 300),
      debitos: debitos.slice(0, 10),
      ...(resultado === "desconhecido" ? { formato: formatoDaResposta(d) } : {}),
    },
  };
}

function normalizarProtesto(d: Record<string, unknown>): Omit<ConsultaNormalizada, "custo" | "homologacao"> {
  const p = (d.protestosVecPj && typeof d.protestosVecPj === "object" ? d.protestosVecPj : {}) as Record<string, unknown>;
  const n = numero(p.numRegistros);
  const registros = lista(p.registros)
    .slice(0, 20)
    .map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
      return {
        cartorio: texto(o.cartorio),
        cidade: texto(o.cidade),
        uf: texto(o.uf),
        data: texto(o.data),
        valor: o.valor ?? null,
        natureza: texto(o.natureza),
      };
    });
  const total = numero(p.valorTotal);
  let resultado: ResultadoConsultaPaga = "desconhecido";
  let resumo = "Resultado não reconhecido: confira os dados.";
  if (n === 0) {
    resultado = "negativa";
    resumo = "Nenhum protesto encontrado no CPF.";
  } else if (n != null && n > 0) {
    resultado = "positiva";
    resumo = `${n} protesto(s)${total != null ? `, total ${real(total)}` : ""}.`;
  }
  return {
    resultado,
    resumo,
    validade: null,
    dados: {
      numRegistros: n,
      valorTotal: total,
      ocorrenciaMaisAntiga: texto(p.ocorrenciaMaisAntiga),
      ocorrenciaMaisRecente: texto(p.ocorrenciaMaisRecente),
      registros,
    },
  };
}

type Pedido = { rota: "cpf" | "cnpj"; corpo: Record<string, unknown> };

function montarPedido(tipo: TipoConsultaPaga, documento: string, pessoaJuridica: boolean, uf: string): Pedido {
  if (tipo === "certidao_federal") {
    return pessoaJuridica
      ? { rota: "cnpj", corpo: { tipo: "certidao-conjunta-de-debitos-pessoa-juridica", cnpj: documento } }
      : { rota: "cpf", corpo: { tipo: "certidao-conjunta-de-debitos-pessoa-fisica", cpf: documento } };
  }
  if (tipo === "certidao_estadual") return { rota: "cpf", corpo: { tipo: "certidao-negativa-de-debitos", cpf: documento, uf } };
  return { rota: "cpf", corpo: { tipo: "protesto-nacional-v2", cpf: documento } };
}

export function apiBrasilConfigurada(): boolean {
  return Boolean(process.env.APIBRASIL_TOKEN?.trim());
}

export async function consultarApiBrasil(
  tipo: TipoConsultaPaga,
  documento: string,
  opcoes: { pessoaJuridica: boolean; uf: string }
): Promise<RespostaApiBrasil> {
  const token = process.env.APIBRASIL_TOKEN?.trim();
  if (!token) return { ok: false, erro: "A consulta não está ligada neste ambiente (falta a chave da APIBrasil)." };

  const homolog = process.env.APIBRASIL_HOMOLOG === "true";
  const { rota, corpo } = montarPedido(tipo, documento, opcoes.pessoaJuridica, opcoes.uf);
  if (homolog) corpo.homolog = true;

  let r: Response;
  try {
    r = await fetch(`${GATEWAY}/${rota}/credits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "User-Agent": "SOMA-app/1.0", Accept: "application/json" },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(LIMITE_MS),
      cache: "no-store",
    });
  } catch (erro) {
    console.error("[apibrasil] sem resposta:", erro);
    return {
      ok: false,
      erro: "A consulta não respondeu a tempo. Pode ter sido cobrada: confira o saldo no painel da APIBrasil antes de tentar de novo.",
    };
  }

  const bruta = (await r.json().catch(() => null)) as Bruta | null;
  if (!r.ok || !bruta || bruta.error !== false) {
    console.error(`[apibrasil] ${tipo} respondeu ${r.status}: ${bruta?.message ?? "sem corpo"}`);
    if (r.status === 402) return { ok: false, erro: "O saldo da APIBrasil acabou. Recarregue o saldo e tente de novo." };
    if (r.status === 401 || r.status === 403) return { ok: false, erro: "A chave da APIBrasil está inválida ou expirada. Avise o administrador." };
    if (r.status === 429) return { ok: false, erro: "Limite de consultas atingido por agora. Tente mais tarde." };
    if (r.status >= 500) return { ok: false, erro: "A APIBrasil está fora do ar agora. Tente de novo em instantes." };
    return { ok: false, erro: bruta?.message ? `A consulta foi recusada: ${bruta.message}` : "A consulta foi recusada. Confira o documento." };
  }

  const data = bruta.data ?? {};
  const base = tipo === "certidao_federal" ? normalizarFederal(data) : tipo === "certidao_estadual" ? normalizarEstadual(data) : normalizarProtesto(data);
  if (base.resultado === "desconhecido" && !("formato" in base.dados)) {
    base.dados = { ...base.dados, formato: formatoDaResposta(data) };
    console.error(`[apibrasil] ${tipo} sem resultado reconhecido:`, JSON.stringify(base.dados.formato).slice(0, 1500));
  }
  return {
    ok: true,
    consulta: {
      ...base,
      custo: bruta.homolog ? 0 : numero(bruta.valor_consulta),
      homologacao: bruta.homolog === true,
    },
  };
}
