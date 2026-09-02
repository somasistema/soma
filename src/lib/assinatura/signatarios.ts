import type { createServiceRoleClient } from "@/lib/supabase/server";
import type { Minuta, Processo } from "@/types/database";
import type { SignatarioEntrada } from "./tipos";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function usuario(supabase: ServiceClient, cdUsuario: string | null) {
  if (!cdUsuario) return null;
  const { data } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("cd_usuario, nm_usuario, ds_email, tp_role, sn_ativo")
    .eq("cd_usuario", cdUsuario)
    .maybeSingle();
  return data ?? null;
}

function exigirEmail(
  papel: string,
  u: { cd_usuario?: string | null; nm_usuario: string; ds_email: string | null } | null,
  contexto: string
): { nome: string; email: string; cd_usuario: string | null } {
  if (!u || !u.ds_email) {
    throw new Error(`Não foi possível definir o signatário "${papel}": ${contexto}`);
  }
  return { nome: u.nm_usuario, email: u.ds_email, cd_usuario: u.cd_usuario ?? null };
}

// Monta as 5 frentes que vão assinar o contrato. Lança um erro claro
// se alguma não puder ser resolvida (comprador sem conta, imobiliária
// sem representante, etc.) — melhor barrar o envio do que mandar
// incompleto.
export async function resolverSignatarios(
  supabase: ServiceClient,
  processo: Processo,
  minuta: Pick<Minuta, "cd_criador">
): Promise<SignatarioEntrada[]> {
  const [corretor, comprador, vendedor] = await Promise.all([
    usuario(supabase, processo.cd_corretor),
    usuario(supabase, processo.cd_comprador),
    usuario(supabase, processo.cd_vendedor),
  ]);

  // Imobiliária — primeiro usuário ativo do perfil 'imobiliaria' vinculado.
  let imobiliaria = null;
  if (processo.cd_imobiliaria) {
    const { data } = await supabase
      .schema("soma")
      .from("usuarios")
      .select("cd_usuario, nm_usuario, ds_email")
      .eq("cd_imobiliaria", processo.cd_imobiliaria)
      .eq("tp_role", "imobiliaria")
      .eq("sn_ativo", true)
      .order("ts_criacao", { ascending: true })
      .limit(1)
      .maybeSingle();
    imobiliaria = data ?? null;
  }

  // Jurídico — quem enviou a minuta; se não der, primeiro jurídico ativo.
  let juridico = await usuario(supabase, minuta.cd_criador);
  if (!juridico || !juridico.ds_email) {
    const { data } = await supabase
      .schema("soma")
      .from("usuarios")
      .select("cd_usuario, nm_usuario, ds_email")
      .eq("tp_role", "juridico")
      .eq("sn_ativo", true)
      .order("ts_criacao", { ascending: true })
      .limit(1)
      .maybeSingle();
    juridico = data ? { ...data, tp_role: "juridico", sn_ativo: true } : juridico;
  }

  return [
    { tp_papel: "corretor", ...exigirEmail("corretor", corretor, "corretor sem conta ou sem e-mail.") },
    {
      tp_papel: "comprador",
      ...exigirEmail("comprador", comprador, "comprador ainda não tem conta no sistema."),
    },
    { tp_papel: "vendedor", ...exigirEmail("vendedor", vendedor, "vendedor sem conta ou sem e-mail.") },
    {
      tp_papel: "imobiliaria",
      ...exigirEmail("imobiliaria", imobiliaria, "nenhum representante ativo da imobiliária."),
    },
    {
      tp_papel: "juridico",
      ...exigirEmail("juridico", juridico, "nenhum usuário do Jurídico disponível."),
    },
  ];
}
