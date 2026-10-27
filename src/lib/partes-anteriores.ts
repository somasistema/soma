import type { createClient } from "@/lib/supabase/server";
import type { ParteAnterior } from "@/app/(dashboard)/processos/novo/processo-form";

const CAMPOS_PARTE_ANTERIOR =
  "nm_parte, ds_telefone, ds_email, ds_profissao, ds_conta_bancaria, ds_cpf, ds_rg, dt_nascimento, ds_endereco";

// Uma sugestão por nome — a que tiver mais dados preenchidos.
function deduplicar(partes: ParteAnterior[]): ParteAnterior[] {
  const preenchidos = (p: ParteAnterior) => Object.values(p).filter((v) => v).length;
  const porNome = new Map<string, ParteAnterior>();
  for (const p of partes) {
    const chave = p.nm_parte.trim().toLowerCase();
    const atual = porNome.get(chave);
    if (!atual || preenchidos(p) > preenchidos(atual)) porNome.set(chave, p);
  }
  return [...porNome.values()].sort((a, b) => a.nm_parte.localeCompare(b.nm_parte));
}

// Pessoas de processos anteriores, pra sugerir no cadastro e na edição
// sem redigitar quem já apareceu em outro negócio.
export async function carregarPartesAnteriores(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<ParteAnterior[]> {
  const { data } = await supabase
    .schema("soma")
    .from("processo_parte")
    .select(CAMPOS_PARTE_ANTERIOR)
    .in("tp_lado", ["vendedor", "comprador", "imobiliaria", "adm", "cliente"])
    .limit(3000)
    .returns<ParteAnterior[]>();
  return deduplicar(data ?? []);
}
