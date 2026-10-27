import { randomUUID } from "node:crypto";
import { Resend } from "resend";

// Toda a aplicação manda e-mail transacional por aqui (convite de
// acesso, etc), nunca pelo envio nativo do Supabase Auth.
// RESEND_FROM_EMAIL só funciona de verdade com um domínio verificado
// no Resend; sem isso, só entrega pro próprio e-mail cadastrado na
// conta Resend (modo de teste).
//
// O cliente é criado só na hora de mandar o e-mail (não no import do
// módulo) — o construtor do Resend lança exceção se a API key estiver
// ausente, e instanciar isso no topo do arquivo derrubava o build
// inteiro (e qualquer rota que só importasse este módulo) sempre que
// RESEND_API_KEY não estivesse configurada no ambiente.
let resend: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "SOMA Soluti <onboarding@resend.dev>";

export async function enviarEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ erro?: string }> {
  const client = getResendClient();
  if (!client) {
    console.error("RESEND_API_KEY não configurada — e-mail não enviado.");
    return { erro: "Envio de e-mail não configurado (RESEND_API_KEY ausente)." };
  }

  // Falha de rede ao falar com o Resend (statusCode nulo, "Unable to fetch
  // data") é passageira: tenta de novo. A chave de idempotência é a mesma nas
  // tentativas, então se o primeiro envio tiver chegado a sair, o Resend não
  // manda o e-mail duas vezes.
  const idempotencyKey = randomUUID();
  const TENTATIVAS = 3;
  let ultimoErro: { message: string } | null = null;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const { error } = await client.emails.send({ from: FROM, to, subject, html }, { idempotencyKey });
    if (!error) return {};

    ultimoErro = error;
    const falhaDeRede = error.statusCode === null;
    if (!falhaDeRede || tentativa === TENTATIVAS) break;
    console.warn(`[resend] falha de rede (tentativa ${tentativa}/${TENTATIVAS}) — repetindo`);
    await new Promise((r) => setTimeout(r, 700 * tentativa));
  }

  console.error("Erro ao enviar e-mail via Resend:", ultimoErro);
  return { erro: ultimoErro?.message ?? "Falha ao enviar e-mail." };
}
