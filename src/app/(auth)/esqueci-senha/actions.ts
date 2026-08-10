"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/mercadopago";
import { enviarEmail } from "@/lib/resend";
import { templateConvite } from "@/lib/email-templates";

export async function solicitarRecuperacaoSenha(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect("/esqueci-senha?erro=Informe o e-mail.");
  }

  const supabase = createServiceRoleClient();
  const siteUrl = getSiteUrl();

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
