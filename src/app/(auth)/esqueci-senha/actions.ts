"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/mercadopago";
import { enviarEmail } from "@/lib/resend";
import { templateConvite } from "@/lib/email-templates";

// Sem login pra acessar essa tela, então precisa de um freio contra
// pedido repetido pro mesmo e-mail (spam na caixa de entrada da
// pessoa, gasto no Resend) — ignora silenciosamente se o último
// pedido pra esse e-mail foi há menos de 2 minutos, sem mudar a
// resposta que a pessoa vê (continua parecendo que funcionou).
const COOLDOWN_MS = 2 * 60 * 1000;

export async function solicitarRecuperacaoSenha(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/esqueci-senha?erro=Informe o e-mail.");
  }

  const supabase = createServiceRoleClient();
  const siteUrl = getSiteUrl();

  const { data: usuario } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("cd_usuario, ts_ultima_recuperacao_senha")
    .eq("ds_email", email)
    .maybeSingle();

  if (usuario?.ts_ultima_recuperacao_senha) {
    const decorrido = Date.now() - new Date(usuario.ts_ultima_recuperacao_senha).getTime();
    if (decorrido < COOLDOWN_MS) {
      redirect("/esqueci-senha?enviado=1");
    }
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: siteUrl ? `${siteUrl}/auth/definir-senha` : undefined },
  });

  // Sempre mostra a mesma mensagem de sucesso, exista ou não esse
  // e-mail cadastrado — não dá pra revelar se uma conta existe (evita
  // que alguém use esta tela pra descobrir quem tem login no sistema).
  if (error || !data) {
    redirect("/esqueci-senha?enviado=1");
  }

  if (usuario) {
    await supabase
      .schema("soma")
      .from("usuarios")
      .update({ ts_ultima_recuperacao_senha: new Date().toISOString() })
      .eq("cd_usuario", usuario.cd_usuario);
  }

  const { subject, html } = templateConvite({
    nome: null,
    link: data.properties.action_link,
    contexto: "recuperacao",
  });

  const { erro: erroEmail } = await enviarEmail({ to: email, subject, html });
  if (erroEmail) {
    console.error("Erro ao enviar e-mail de recuperação de senha:", erroEmail);
  }

  redirect("/esqueci-senha?enviado=1");
}
