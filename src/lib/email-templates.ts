import logoSoma from "@/assets/SOMA.png";
import { getSiteUrl } from "@/lib/mercadopago";

const COR_MARCA = "#10182B";
const COR_ACCENT = "#B8863C";

// Casca visual comum a todo e-mail transacional — HTML com estilo
// inline (cliente de e-mail não roda CSS externo/Tailwind). Logo
// referenciada pela URL absoluta do próprio deploy, não em base64
// (Gmail/Outlook costumam bloquear imagem embutida).
function casca({ tituloInterno, corpoHtml }: { tituloInterno: string; corpoHtml: string }) {
  const siteUrl = getSiteUrl() ?? "https://soma-eta-three.vercel.app";
  const logoUrl = `${siteUrl}${logoSoma.src}`;

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${tituloInterno}</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f5; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background-color:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e5e5;">
            <tr>
              <td style="background-color:${COR_MARCA}; padding:28px 32px; text-align:center;">
                <img src="${logoUrl}" alt="SOMA Soluti" height="40" style="height:40px; width:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                ${corpoHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px; background-color:#fafafa; border-top:1px solid #eee;">
                <p style="margin:0; font-size:12px; color:#888; line-height:1.5;">
                  SOMA Assessoria Imobiliária — este é um e-mail automático, não é preciso responder.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function botao(texto: string, link: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr>
      <td style="border-radius:10px; background-color:${COR_ACCENT};">
        <a href="${link}" target="_blank" style="display:inline-block; padding:12px 28px; font-size:14px; font-weight:bold; color:#ffffff; text-decoration:none; border-radius:10px;">
          ${texto}
        </a>
      </td>
    </tr>
  </table>`;
}

// E-mail de convite — usado tanto pra dar acesso ao cliente (depois
// do pagamento) quanto pra convidar um novo integrante da equipe. O
// link vem de supabase.auth.admin.generateLink() (tipo "invite" pra
// gente nova, "recovery" pra reenvio de convite já existente).
export function templateConvite({
  nome,
  link,
  contexto,
}: {
  nome: string | null;
  link: string;
  contexto: "cliente" | "equipe";
}) {
  const saudacao = nome ? `Olá, ${nome}!` : "Olá!";
  const intro =
    contexto === "cliente"
      ? "Seu pagamento foi confirmado e o acesso à plataforma SOMA já está liberado. Por lá você acompanha os documentos, andamentos e pendências do seu processo em tempo real."
      : "Você foi convidado a acessar a plataforma SOMA como parte da equipe. Defina sua senha pra começar a usar o sistema.";

  const corpoHtml = `
    <p style="margin:0 0 4px; font-size:18px; font-weight:bold; color:${COR_MARCA};">${saudacao}</p>
    <p style="margin:0 0 8px; font-size:14px; color:#333; line-height:1.6;">${intro}</p>
    <p style="margin:16px 0 0; font-size:14px; color:#333; line-height:1.6;">Clique no botão abaixo pra definir sua senha e entrar:</p>
    ${botao("Definir senha e acessar", link)}
    <p style="margin:16px 0 0; font-size:12px; color:#999; line-height:1.5;">
      Se o botão não funcionar, copie e cole este link no navegador:<br />
      <a href="${link}" style="color:${COR_ACCENT}; word-break:break-all;">${link}</a>
    </p>
  `;

  return {
    subject:
      contexto === "cliente" ? "Seu acesso à SOMA está liberado" : "Convite de acesso — SOMA",
    html: casca({ tituloInterno: "Convite de acesso — SOMA", corpoHtml }),
  };
}
