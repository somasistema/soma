"use server";

import { createClient } from "@/lib/supabase/server";

export type ChatActionState = { sucesso: true } | { sucesso: false; erro: string };

export async function enviarMensagemProcesso(
  cdProcesso: string,
  texto: string
): Promise<ChatActionState> {
  const t = texto.trim();
  if (!t) return { sucesso: false, erro: "Escreva uma mensagem." };
  if (t.length > 4000) return { sucesso: false, erro: "Mensagem muito longa." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { sucesso: false, erro: "Sessão expirada. Faça login novamente." };

  const { data: eu } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("nm_usuario")
    .eq("cd_usuario", user.id)
    .maybeSingle();

  const { error } = await supabase.schema("soma").from("mensagens_processo").insert({
    cd_processo: cdProcesso,
    cd_autor: user.id,
    nm_autor: eu?.nm_usuario ?? "Usuário",
    ds_texto: t,
  });

  if (error) return { sucesso: false, erro: error.message };
  return { sucesso: true };
}
