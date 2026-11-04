import { notFound, redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { tituloDasPartes } from "@/lib/nomes-partes";
import type { ModeloContrato, ModeloContratoVersao } from "@/types/database";
import { EditorModelo, type ProcessoExemplo } from "../editor-modelo";

// O assistente de IA (trocar dados por campos) roda como ação desta página e leva até ~35 s.
export const maxDuration = 60;

const PODE_VER = new Set(["master", "juridico", "gerente", "despachante"]);

export default async function ModeloPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await getUsuarioAtual();
  if (!PODE_VER.has(usuario.tp_role)) redirect("/dashboard");

  const editavel = usuario.tp_role === "master" || usuario.tp_role === "juridico";
  const supabase = await createClient();

  const { data: modelo } = await supabase
    .schema("soma")
    .from("modelos_contrato")
    .select("*")
    .eq("cd_modelo", id)
    .maybeSingle<ModeloContrato>();
  if (!modelo) notFound();

  const [{ data: versoes }, { data: processos }] = await Promise.all([
    supabase
      .schema("soma")
      .from("modelo_contrato_versoes")
      .select("*")
      .eq("cd_modelo", id)
      .order("nr_versao", { ascending: false })
      .returns<ModeloContratoVersao[]>(),
    // Últimos processos de contrato, pra testar o modelo com dados de verdade.
    supabase
      .schema("soma")
      .from("processos")
      .select("cd_processo, ds_numero_processo, tp_contrato")
      .eq("tp_processo", "contrato")
      .order("ts_criacao", { ascending: false })
      .limit(30)
      .returns<{ cd_processo: string; ds_numero_processo: string; tp_contrato: string }[]>(),
  ]);

  const ids = (processos ?? []).map((p) => p.cd_processo);
  const { data: partes } = ids.length
    ? await supabase
        .schema("soma")
        .from("processo_parte")
        .select("cd_processo, nm_parte, tp_lado, nr_ordem")
        .in("cd_processo", ids)
        .in("tp_lado", ["vendedor", "comprador"])
        .order("nr_ordem")
        .returns<{ cd_processo: string; nm_parte: string; tp_lado: string; nr_ordem: number }[]>()
    : { data: [] };

  const exemplos: ProcessoExemplo[] = (processos ?? []).map((p) => {
    const titulo = tituloDasPartes((partes ?? []).filter((x) => x.cd_processo === p.cd_processo));
    return {
      cd_processo: p.cd_processo,
      rotulo: `${p.ds_numero_processo}${p.tp_contrato === "locacao" ? " (aluguel)" : ""}${titulo ? ` — ${titulo}` : ""}`,
    };
  });

  return <EditorModelo key={modelo.cd_modelo} modelo={modelo} editavel={editavel} versoes={versoes ?? []} processos={exemplos} />;
}
