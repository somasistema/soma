"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import type { StatusPendencia } from "@/types/database";

export type AcaoState = { sucesso: true } | { sucesso: false; erro: string };

export async function criarPendencia(
  cdProcesso: string,
  dsPendencia: string,
  dtPrazo: string | null
): Promise<AcaoState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.schema("soma").from("pendencias").insert({
    cd_processo: cdProcesso,
    cd_responsavel: user.id,
    ds_pendencia: dsPendencia,
    dt_prazo: dtPrazo,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}

export async function atualizarStatusPendencia(
  cdPendencia: string,
  novoStatus: StatusPendencia
): Promise<AcaoState> {
  const supabase = await createClient();

  const { error } = await supabase
    .schema("soma")
    .from("pendencias")
    .update({ tp_status: novoStatus })
    .eq("cd_pendencia", cdPendencia);

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}

// Apaga o processo e tudo dele (partes, documentos, minutas, contrato,
// orçamentos, chat...). A permissão é checada em fn_excluir_processo
// (Master, ou perfil com "excluir" em Processos); os arquivos no
// Storage são apagados aqui com service_role.
export async function excluirProcesso(cdProcesso: string): Promise<AcaoState> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("soma")
    .rpc("fn_excluir_processo", { p_cd_processo: cdProcesso });

  if (error) {
    return { sucesso: false, erro: error.message || "Não foi possível excluir o processo." };
  }

  const caminhos = (data ?? {}) as { documentos?: string[]; minutas?: string[] };
  const service = createServiceRoleClient();
  await Promise.all([
    caminhos.documentos?.length
      ? service.storage.from("documentos").remove(caminhos.documentos)
      : null,
    caminhos.minutas?.length ? service.storage.from("minutas").remove(caminhos.minutas) : null,
  ]).catch((e) => console.error("[excluir processo] falha ao apagar arquivos:", e));

  revalidatePath("/processos");
  redirect("/processos");
}
