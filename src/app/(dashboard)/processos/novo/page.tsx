import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Corretor, Imobiliaria } from "@/types/database";
import { ProcessoForm, type ParteAnterior } from "./processo-form";

const PODE_CRIAR_PROCESSO = new Set(["master", "juridico"]);

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

export default async function NovoProcessoPage() {
  const usuario = await getUsuarioAtual();
  if (!PODE_CRIAR_PROCESSO.has(usuario.tp_role)) {
    redirect("/processos");
  }

  const supabase = await createClient();

  const [{ data: imobiliarias }, { data: corretores }, { data: partesAnteriores }] =
    await Promise.all([
      supabase
        .schema("soma")
        .from("imobiliarias")
        .select("*")
        .eq("sn_ativo", true)
        .order("nm_imobiliaria")
        .returns<Imobiliaria[]>(),
      supabase
        .schema("soma")
        .from("corretores")
        .select("*")
        .eq("sn_ativo", true)
        .order("nm_corretor")
        .returns<Corretor[]>(),
      supabase
        .schema("soma")
        .from("processo_parte")
        .select(CAMPOS_PARTE_ANTERIOR)
        .in("tp_lado", ["vendedor", "comprador", "imobiliaria", "adm", "cliente"])
        .limit(3000)
        .returns<ParteAnterior[]>(),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
        Novo processo (Contrato)
      </h1>
      <ProcessoForm
        imobiliarias={imobiliarias ?? []}
        corretoresCadastro={corretores ?? []}
        partesAnteriores={deduplicar(partesAnteriores ?? [])}
      />
    </div>
  );
}
