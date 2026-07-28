"use server";

import { createClient } from "@/lib/supabase/server";
import type { StatusPendencia } from "@/types/database";

export type AcaoState = { sucesso: true } | { sucesso: false; erro: string };

// RLS (soma.andamentos_insert) já garante que só o Despachante do
// processo ou Master conseguem inserir — aqui só repassamos o erro.
export async function criarAndamento(
  cdProcesso: string,
  nmEtapa: string,
  dsAndamento: string
): Promise<AcaoState> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { sucesso: false, erro: "Sessão expirada. Faça login novamente." };
  }

  const { error } = await supabase.schema("soma").from("andamentos").insert({
    cd_processo: cdProcesso,
    cd_despachante: user.id,
    nm_etapa: nmEtapa,
    ds_andamento: dsAndamento,
  });

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true };
}

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
