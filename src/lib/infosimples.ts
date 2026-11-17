import type { ConsultaNormalizada } from "@/lib/apibrasil";
import type { ResultadoConsultaPaga } from "@/lib/consultas-pagas";

// Cliente da Infosimples (api.infosimples.com, API v2) para a Certidão Negativa de Débitos municipais
// de Salvador. Só roda no servidor. Cada chamada cobra do saldo (até quando o documento é recusado),
// então nunca repete sozinha e o documento é validado antes de chamar.
//   POST /api/v2/consultas/pref/ba/salvador/cnd   (corpo form-urlencoded: token, cpf ou cnpj, timeout)
//   code 200 = processou; qualquer outro code é erro e a mensagem vem em code_message.

const URL_CND = "https://api.infosimples.com/api/v2/consultas/pref/ba/salvador/cnd";
const LIMITE_MS = 55000;

export type RespostaInfosimples = { ok: true; consulta: ConsultaNormalizada } | { ok: false; erro: string };

type Bruta = {
  code?: number;
  code_message?: string;
  errors?: unknown[];
  header?: { price?: string | number; billable?: boolean };
  data?: Record<string, unknown>[];
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

// "13/10/2026" ou "2026-10-13" -> "2026-10-13"
function paraIso(v: unknown): string | null {
  const t = texto(v);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(t);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export function infosimplesConfigurada(): boolean {
  return Boolean(process.env.INFOSIMPLES_TOKEN?.trim());
}

function normalizarCnd(d: Record<string, unknown>, custo: number | null): ConsultaNormalizada {
  const mensagem = texto(d.mensagem);
  let resultado: ResultadoConsultaPaga = "desconhecido";
  let resumo = "Resultado não reconhecido: confira o comprovante.";

  if (d.conseguiu_emitir_certidao_negativa === true) {
    resultado = "negativa";
    resumo = "Certidão negativa de débitos municipais de Salvador emitida.";
  } else if (/n[ãa]o est[áa] inscrit/i.test(mensagem)) {
    // Sem cadastro na prefeitura: não é débito, mas também não há certidão.
    resumo = "Não inscrito nos cadastros da Secretaria da Fazenda de Salvador (sem certidão emitida).";
  } else if (d.conseguiu_emitir_certidao_negativa === false) {
    resultado = "positiva";
    resumo = mensagem ? `Certidão não emitida: ${mensagem.slice(0, 280)}` : "Certidão negativa não emitida: constam débitos ou pendências.";
  }

  return {
    resultado,
    resumo,
    validade: paraIso(d.normalizado_data_validade) ?? paraIso(d.data_validade),
    dados: {
      numeroCertidao: texto(d.numero_certidao),
      codigoControle: texto(d.codigo_controle_certidao),
      inscricaoMunicipal: texto(d.inscricao_municipal),
      mensagem: mensagem.slice(0, 1500),
      comprovante: texto(d.site_receipt),
    },
    custo,
    homologacao: false,
  };
}

export async function consultarCndSalvador(documento: string, pessoaJuridica: boolean): Promise<RespostaInfosimples> {
  const token = process.env.INFOSIMPLES_TOKEN?.trim();
  if (!token) return { ok: false, erro: "A consulta não está ligada neste ambiente (falta a chave da Infosimples)." };

  const corpo = new URLSearchParams({ token, timeout: "45" });
  corpo.set(pessoaJuridica ? "cnpj" : "cpf", documento);

  let r: Response;
  try {
    r = await fetch(URL_CND, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "SOMA-app/1.0", Accept: "application/json" },
      body: corpo,
      signal: AbortSignal.timeout(LIMITE_MS),
      cache: "no-store",
    });
  } catch (erro) {
    console.error("[infosimples] sem resposta:", erro);
    return {
      ok: false,
      erro: "A consulta não respondeu a tempo. Pode ter sido cobrada: confira o saldo no painel da Infosimples antes de tentar de novo.",
    };
  }

  const bruta = (await r.json().catch(() => null)) as Bruta | null;
  const code = bruta?.code ?? r.status;
  if (code !== 200 || !bruta?.data?.[0]) {
    console.error(`[infosimples] cnd respondeu ${code}: ${bruta?.code_message ?? "sem corpo"}`);
    if (code === 601 || r.status === 401 || r.status === 403) {
      return { ok: false, erro: "A chave da Infosimples está inválida ou desativada. Avise o administrador." };
    }
    if (code === 607 || code === 606) return { ok: false, erro: "A prefeitura recusou o documento informado. Confira o CPF ou CNPJ." };
    if (r.status === 402 || /saldo|cr[ée]dito/i.test(bruta?.code_message ?? "")) {
      return { ok: false, erro: "O saldo da Infosimples acabou. Recarregue o saldo e tente de novo." };
    }
    if (r.status >= 500) return { ok: false, erro: "A Infosimples está fora do ar agora. Tente de novo em instantes." };
    return {
      ok: false,
      erro: "O site da prefeitura não respondeu a esta consulta agora. Tente de novo em alguns minutos.",
    };
  }

  const preco = Number(bruta.header?.price);
  return { ok: true, consulta: normalizarCnd(bruta.data[0], Number.isFinite(preco) ? preco : null) };
}
