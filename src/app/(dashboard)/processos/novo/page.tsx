import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Imobiliaria, Usuario } from "@/types/database";
import { ProcessoForm } from "./processo-form";

const PODE_CRIAR_PROCESSO = new Set(["master", "juridico"]);

export default async function NovoProcessoPage() {
  const usuario = await getUsuarioAtual();
  if (!PODE_CRIAR_PROCESSO.has(usuario.tp_role)) {
    redirect("/processos");
  }

  const supabase = await createClient();

  const [{ data: imobiliarias }, { data: corretores }, { data: vendedores }] = await Promise.all([
    supabase
      .schema("soma")
      .from("imobiliarias")
      .select("*")
      .eq("sn_ativo", true)
      .order("nm_imobiliaria")
      .returns<Imobiliaria[]>(),
    supabase
      .schema("soma")
      .from("usuarios")
      .select("cd_usuario, nm_usuario")
      .eq("tp_role", "corretor")
      .eq("sn_ativo", true)
      .order("nm_usuario")
      .returns<Pick<Usuario, "cd_usuario" | "nm_usuario">[]>(),
    supabase
      .schema("soma")
      .from("usuarios")
      .select("cd_usuario, nm_usuario")
      .eq("tp_role", "vendedor")
      .eq("sn_ativo", true)
      .order("nm_usuario")
      .returns<Pick<Usuario, "cd_usuario" | "nm_usuario">[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-serif-doc text-2xl font-semibold text-foreground">Novo processo (Contrato)</h1>
      <ProcessoForm
        imobiliarias={imobiliarias ?? []}
        corretores={corretores ?? []}
        vendedores={vendedores ?? []}
      />
    </div>
  );
}
