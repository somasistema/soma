// Link de convite/recuperação: NUNCA manda o `action_link` bruto do
// Supabase (GET direto em <projeto>.supabase.co/auth/v1/verify) — esse
// link é de uso único, e scanners de segurança de e-mail corporativo
// (Outlook Safe Links, Microsoft Defender, gateways antivírus etc)
// abrem automaticamente todo link recebido pra checar phishing, o que
// consome o token antes da pessoa real clicar. Resultado: "Link
// inválido ou expirado" no primeiro clique de verdade.
//
// Fix recomendado pelo próprio Supabase: mandar um link pro NOSSO
// domínio com o token_hash na query string, e só consumir o token
// chamando supabase.auth.verifyOtp() no client, dentro da nossa
// página — scanners fazem GET simples na URL, não executam JS pra
// chamar a API de verificação.
export function linkDefinirSenha(
  siteUrl: string | null,
  hashedToken: string,
  tipo: "invite" | "recovery"
) {
  const base = siteUrl ?? "https://www.somasoluti.com.br";
  return `${base}/auth/definir-senha?token_hash=${encodeURIComponent(hashedToken)}&type=${tipo}`;
}
