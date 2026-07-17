"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RoleUsuario } from "@/types/database";

async function autenticar(email: string, senha: string) {
  if (!email || !senha) {
    redirect("/login?erro=Preencha e-mail e senha.");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    redirect("/login?erro=E-mail ou senha inválidos.");
  }

  redirect("/dashboard");
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const senha = String(formData.get("senha") ?? "");
  await autenticar(email, senha);
}

// Credenciais das contas de demonstração vêm de env vars server-only (nunca
// NEXT_PUBLIC_) para não expor senha real no HTML/bundle do cliente.
const DEMO_CREDENCIAIS: Partial<Record<RoleUsuario, { email?: string; senha?: string }>> = {
  master: {
    email: process.env.DEMO_MASTER_EMAIL,
    senha: process.env.DEMO_MASTER_SENHA,
  },
};

export async function loginDemo(formData: FormData) {
  const perfil = String(formData.get("perfil") ?? "") as RoleUsuario;
  const credenciais = DEMO_CREDENCIAIS[perfil];

  if (!credenciais?.email || !credenciais?.senha) {
    redirect("/login?erro=Conta de demonstração ainda não configurada.");
  }

  await autenticar(credenciais.email, credenciais.senha);
}
