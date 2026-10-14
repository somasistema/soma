import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CATEGORIA_DOC_INTAKE_LABEL,
  LADO_PARTE_LABEL,
  type CategoriaDocIntake,
  type LadoParte,
} from "@/types/database";

export type ParteResumo = { nm_parte: string; tp_lado: LadoParte };

// "Vendedor — Maria Silva — Identidade ou CNH": identifica o documento
// pela pessoa e pelo item, não pelo nome do arquivo (que quem anexa
// pelo link escolhe como quiser).
export function rotuloDocumento(
  doc: {
    cd_parte: string | null;
    tp_categoria_intake: string | null;
    nm_tipo_documento: string;
    tp_perfil_alvo?: string;
  },
  partes: Map<string, ParteResumo>
): string {
  const tipo =
    CATEGORIA_DOC_INTAKE_LABEL[doc.tp_categoria_intake as CategoriaDocIntake] ??
    doc.nm_tipo_documento;
  const parte = doc.cd_parte ? partes.get(doc.cd_parte) : undefined;
  if (parte) return `${LADO_PARTE_LABEL[parte.tp_lado]} — ${parte.nm_parte} — ${tipo}`;
  if (doc.tp_perfil_alvo === "imovel") return `Imóvel — ${tipo}`;
  return tipo;
}

export async function carregarPartesResumo(
  supabase: SupabaseClient,
  cdProcesso: string
): Promise<Map<string, ParteResumo>> {
  const { data } = await supabase
    .schema("soma")
    .from("processo_parte")
    .select("cd_parte, nm_parte, tp_lado")
    .eq("cd_processo", cdProcesso);
  return new Map(
    ((data ?? []) as { cd_parte: string; nm_parte: string; tp_lado: LadoParte }[]).map((p) => [
      p.cd_parte,
      { nm_parte: p.nm_parte, tp_lado: p.tp_lado },
    ])
  );
}
