"use server";

import { getUsuarioAtual } from "@/lib/auth";
import { INTEGRACOES } from "@/lib/integracoes";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type ResultadoTeste = { ok: boolean; ms: number; detalhe: string };

const LIMITE_MS = 10000;

// Cada teste usa só uma chamada de leitura que não cobra (listar modelos, listar domínios, consultar a própria
// conta...). Nunca devolve valor de segredo, só o veredito.
async function chamar(url: string, headers: Record<string, string> = {}): Promise<Response> {
  // Alguns serviços públicos (BrasilAPI, ViaCEP) recusam ou travam pedidos sem User-Agent.
  return fetch(url, {
    headers: { "User-Agent": "SOMA-app/1.0", Accept: "application/json", ...headers },
    signal: AbortSignal.timeout(LIMITE_MS),
    cache: "no-store",
  });
}

async function executar(id: string): Promise<{ ok: boolean; detalhe: string }> {
  switch (id) {
    case "supabase": {
      const { error } = await createServiceRoleClient()
        .schema("soma")
        .from("imobiliarias")
        .select("cd_imobiliaria", { head: true, count: "exact" });
      return error ? { ok: false, detalhe: `Banco respondeu com erro: ${error.message}` } : { ok: true, detalhe: "Banco respondeu." };
    }
    case "anthropic": {
      const chave = process.env.ANTHROPIC_API_KEY;
      if (!chave) return { ok: false, detalhe: "ANTHROPIC_API_KEY não está configurada." };
      const r = await chamar("https://api.anthropic.com/v1/models?limit=1", {
        "x-api-key": chave,
        "anthropic-version": "2023-06-01",
      });
      if (r.ok) return { ok: true, detalhe: "Chave válida." };
      if (r.status === 401) return { ok: false, detalhe: "Chave recusada (inválida ou revogada)." };
      return { ok: false, detalhe: `A Anthropic respondeu HTTP ${r.status}.` };
    }
    case "resend": {
      const chave = process.env.RESEND_API_KEY;
      if (!chave) return { ok: false, detalhe: "RESEND_API_KEY não está configurada." };
      const r = await chamar("https://api.resend.com/domains", { Authorization: `Bearer ${chave}` });
      if (r.ok) {
        const json = (await r.json().catch(() => null)) as { data?: { name: string; status: string }[] } | null;
        const verificados = (json?.data ?? []).filter((d) => d.status === "verified").map((d) => d.name);
        return {
          ok: true,
          detalhe: verificados.length
            ? `Chave válida. Domínio(s) verificado(s): ${verificados.join(", ")}.`
            : "Chave válida, mas nenhum domínio verificado: e-mails só chegam ao dono da conta Resend.",
        };
      }
      // Chave só de envio não pode listar domínios, mas serve para o sistema.
      if (r.status === 401 || r.status === 403) {
        return { ok: true, detalhe: "A chave existe e é restrita a envio (não lista domínios). Isso é suficiente para o sistema." };
      }
      return { ok: false, detalhe: `O Resend respondeu HTTP ${r.status}.` };
    }
    case "clicksign": {
      const token = process.env.CLICKSIGN_API_TOKEN;
      if (!token) return { ok: false, detalhe: "CLICKSIGN_API_TOKEN não está configurado." };
      const host = process.env.CLICKSIGN_SANDBOX === "true" ? "https://sandbox.clicksign.com" : "https://app.clicksign.com";
      const r = await chamar(`${host}/api/v3/envelopes?page%5Bsize%5D=1`, {
        Authorization: token,
        Accept: "application/vnd.api+json",
      });
      if (r.ok) return { ok: true, detalhe: `Token válido (${host.includes("sandbox") ? "sandbox" : "produção"}).` };
      if (r.status === 401 || r.status === 403) {
        return { ok: false, detalhe: "Token recusado. Confira se ele é da conta certa (sandbox e produção são contas separadas)." };
      }
      return { ok: false, detalhe: `A Clicksign respondeu HTTP ${r.status}.` };
    }
    case "mercadopago": {
      const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
      if (!token) return { ok: false, detalhe: "MERCADOPAGO_ACCESS_TOKEN não está configurado." };
      const r = await chamar("https://api.mercadopago.com/users/me", { Authorization: `Bearer ${token}` });
      if (r.ok) return { ok: true, detalhe: token.startsWith("TEST-") ? "Token de teste válido." : "Token de produção válido." };
      if (r.status === 401 || r.status === 403) return { ok: false, detalhe: "Token recusado pelo Mercado Pago." };
      return { ok: false, detalhe: `O Mercado Pago respondeu HTTP ${r.status}.` };
    }
    case "viacep": {
      const r = await chamar("https://viacep.com.br/ws/01001000/json/");
      if (!r.ok) return { ok: false, detalhe: `O ViaCEP respondeu HTTP ${r.status}.` };
      const j = (await r.json().catch(() => null)) as { logradouro?: string } | null;
      return j?.logradouro ? { ok: true, detalhe: "Respondeu com o endereço de teste." } : { ok: false, detalhe: "Resposta sem endereço." };
    }
    case "brasilapi": {
      // CNPJ do Banco do Brasil, público.
      const r = await chamar("https://brasilapi.com.br/api/cnpj/v1/00000000000191");
      if (!r.ok) return { ok: false, detalhe: `A BrasilAPI respondeu HTTP ${r.status}.` };
      const j = (await r.json().catch(() => null)) as { razao_social?: string } | null;
      return j?.razao_social ? { ok: true, detalhe: "Respondeu com a empresa de teste." } : { ok: false, detalhe: "Resposta sem razão social." };
    }
    default:
      return { ok: false, detalhe: "Esta integração não tem teste automático." };
  }
}

export async function testarIntegracao(id: string): Promise<ResultadoTeste> {
  const usuario = await getUsuarioAtual();
  if (usuario.tp_role !== "master") return { ok: false, ms: 0, detalhe: "Só o Master testa integrações." };

  const alvo = INTEGRACOES.find((i) => i.id === id);
  if (!alvo?.testavel) return { ok: false, ms: 0, detalhe: "Esta integração não tem teste automático." };

  const inicio = Date.now();
  try {
    const r = await executar(id);
    return { ...r, ms: Date.now() - inicio };
  } catch (erro) {
    const estouro = erro instanceof Error && (erro.name === "TimeoutError" || erro.name === "AbortError");
    console.error(`[integracoes] teste de ${id} falhou:`, erro);
    return {
      ok: false,
      ms: Date.now() - inicio,
      detalhe: estouro ? `Sem resposta em ${LIMITE_MS / 1000} s.` : "Não foi possível conectar (rede ou serviço fora do ar).",
    };
  }
}
