"use server";

import { createClient } from "@/lib/supabase/server";

export type ConviteResultado = { sucesso: true; token: string } | { sucesso: false; erro: string };

// Gera (ou atualiza) o link do cliente na hora — o link já funciona antes
// de o processo ser criado. A permissão (Master/Jurídico) é checada no banco.
export async function salvarConvite(input: {
  token: string | null;
  lado: "vendedor" | "comprador";
  nome: string;
  cpf: string;
  telefone: string;
}): Promise<ConviteResultado> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("soma").rpc("fn_salvar_convite_parte", {
    p_token: input.token,
    p_tp_lado: input.lado,
    p_dados: { nm_parte: input.nome, ds_cpf: input.cpf, ds_telefone: input.telefone },
  });

  if (error || !data) {
    return { sucesso: false, erro: error?.message ?? "Não foi possível gerar o link." };
  }
  return { sucesso: true, token: data as string };
}

export type ConviteSituacao =
  | {
      sucesso: true;
      dados: {
        nm_parte: string | null;
        ds_cpf: string | null;
        ds_rg: string | null;
        dt_nascimento: string | null;
        ds_telefone: string | null;
        ds_email: string | null;
        ds_profissao: string | null;
        ds_endereco: string | null;
        ds_conta_bancaria: string | null;
      };
      documentos: string[];
    }
  | { sucesso: false; erro: string };

// O que o cliente já preencheu/enviou pelo link (leitura pelo time, via RLS).
export async function consultarConvite(token: string): Promise<ConviteSituacao> {
  const supabase = await createClient();

  const { data: convite, error } = await supabase
    .schema("soma")
    .from("convites_parte")
    .select(
      "nm_parte, ds_cpf, ds_rg, dt_nascimento, ds_telefone, ds_email, ds_profissao, ds_endereco, ds_conta_bancaria"
    )
    .eq("cd_convite", token)
    .maybeSingle();

  if (error || !convite) {
    return { sucesso: false, erro: error?.message ?? "Link não encontrado." };
  }

  const { data: docs } = await supabase
    .schema("soma")
    .from("convite_documentos")
    .select("tp_categoria_intake, nm_arquivo")
    .eq("cd_convite", token)
    .order("ts_criacao");

  return {
    sucesso: true,
    dados: convite,
    documentos: (docs ?? []).map((d) => `${d.tp_categoria_intake}: ${d.nm_arquivo}`),
  };
}
