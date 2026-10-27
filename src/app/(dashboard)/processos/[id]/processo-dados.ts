import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Processo } from "@/types/database";

// Processo da rota — `cache` deixa o layout e a aba abertas compartilharem
// a mesma consulta na requisição. Só contrato tem as abas de negócio
// (partes, imóvel, documentos, minuta).
export const carregarProcesso = cache(async (cdProcesso: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .schema("soma")
    .from("processos")
    .select("*")
    .eq("cd_processo", cdProcesso)
    .single<Processo>();
  return data;
});

export async function exigirProcessoContrato(cdProcesso: string): Promise<Processo> {
  const processo = await carregarProcesso(cdProcesso);
  if (!processo || processo.tp_processo !== "contrato") notFound();
  return processo;
}
