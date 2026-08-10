import { Resend } from "resend";

// Cliente único do Resend — toda a aplicação manda e-mail transacional
// por aqui (convite de acesso, etc), nunca pelo envio nativo do
// Supabase Auth. RESEND_FROM_EMAIL só funciona de verdade com um
// domínio verificado no Resend; sem isso, só entrega pro próprio
// e-mail cadastrado na conta Resend (modo de teste).
const resend = new Resend(process.env.RESEND_API_KEY);

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
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });

  if (error) {
    console.error("Erro ao enviar e-mail via Resend:", error);
    return { erro: error.message };
  }

  return {};
}
