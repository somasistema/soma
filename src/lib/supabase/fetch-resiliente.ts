// fetch que tenta de novo quando a conexão com o Supabase cai de forma passageira
// ("TypeError: fetch failed"). Só repete quando é seguro:
//   - GET/HEAD: qualquer falha de rede (não muda nada no servidor);
//   - demais métodos (RPC, insert, update...): só quando a conexão nem chegou a
//     abrir (timeout de conexão, recusada, DNS) — o pedido não saiu daqui, então
//     repetir não duplica nenhuma gravação.
const TENTATIVAS = 3;
const ESPERA_MS = 400;

const CODIGOS_ANTES_DO_ENVIO = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

function codigoDaFalha(erro: unknown): string | undefined {
  const causa = (erro as { cause?: { code?: string } } | null)?.cause;
  return causa?.code;
}

export const fetchResiliente: typeof fetch = async (entrada, init) => {
  const metodo = (
    init?.method ?? (typeof entrada === "object" && "method" in entrada ? entrada.method : "GET")
  ).toUpperCase();
  const idempotente = metodo === "GET" || metodo === "HEAD";

  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      return await fetch(entrada, init);
    } catch (erro) {
      ultimoErro = erro;
      const codigo = codigoDaFalha(erro);
      const podeRepetir = idempotente || (codigo !== undefined && CODIGOS_ANTES_DO_ENVIO.has(codigo));
      // Cancelamento pedido por quem chamou não se repete.
      if (!podeRepetir || (erro as { name?: string }).name === "AbortError" || tentativa === TENTATIVAS) {
        throw erro;
      }
      console.warn(
        `[supabase] conexão falhou (${codigo ?? "sem código"}), tentativa ${tentativa}/${TENTATIVAS} — repetindo`
      );
      await new Promise((r) => setTimeout(r, ESPERA_MS * tentativa));
    }
  }
  throw ultimoErro;
};
