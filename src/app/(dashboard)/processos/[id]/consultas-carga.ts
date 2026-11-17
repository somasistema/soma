import { getUsuarioAtual } from "@/lib/auth";
import type { ConsultaPaga } from "@/lib/consultas-pagas";
import { createClient } from "@/lib/supabase/server";

// Histórico de consultas pagas do processo. Só Master e Jurídico veem. Se a tabela ainda não existe
// (migration 082), devolve semHistorico para a tela explicar em vez de quebrar.
export async function carregarConsultas(
  cdProcesso: string
): Promise<{ consultas: ConsultaPaga[] | null; semHistorico: boolean }> {
  const usuario = await getUsuarioAtual();
  if (usuario.tp_role !== "master" && usuario.tp_role !== "juridico") return { consultas: null, semHistorico: false };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("soma")
    .from("consultas_externas")
    .select("cd_consulta, cd_parte, tp_consulta, ds_documento, ds_uf, tp_resultado, ds_resumo, dt_validade, vl_custo, sn_homologacao, ts_criacao")
    .eq("cd_processo", cdProcesso)
    .order("ts_criacao", { ascending: false });
  if (error) return { consultas: null, semHistorico: true };
  return { consultas: (data ?? []).map((c) => ({ ...c, vl_custo: Number(c.vl_custo) })) as ConsultaPaga[], semHistorico: false };
}
