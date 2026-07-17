import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Usuario } from "@/types/database";

export async function getUsuarioAtual(): Promise<Usuario> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: usuario } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("*")
    .eq("cd_usuario", user.id)
    .single<Usuario>();

  if (!usuario) {
    redirect("/login?erro=Usuário sem perfil cadastrado. Fale com o Master.");
  }

  return usuario;
}
