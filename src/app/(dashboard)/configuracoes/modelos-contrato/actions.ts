"use server";

import { revalidatePath } from "next/cache";
import { docxParaTexto } from "@/lib/docx-texto";
import type { SugestoesModelo } from "@/lib/modelo-edicoes";
import { sugerirEdicoesModelo } from "@/lib/modelo-ia";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioAtual } from "@/lib/auth";

export type ModeloState = { erro: string } | { cd_modelo: string };

type SalvarInput = {
  cd_modelo: string | null;
  nm_modelo: string;
  ds_descricao: string;
  ds_conteudo: string;
};

const PODE_EDITAR = new Set(["master", "juridico"]);

export async function salvarModelo(input: SalvarInput): Promise<ModeloState> {
  const nm = input.nm_modelo.trim();
  const conteudo = input.ds_conteudo.trim();

  if (nm.length < 2) return { erro: "Informe o nome do modelo." };
  if (conteudo.length < 10) return { erro: "O modelo está muito curto." };

  const supabase = await createClient();

  const { data, error } = await supabase.schema("soma").rpc("fn_salvar_modelo_contrato", {
    p_cd_modelo: input.cd_modelo,
    p_nm_modelo: nm,
    p_ds_descricao: input.ds_descricao.trim() || null,
    p_ds_conteudo: input.ds_conteudo,
  });

  if (error) return { erro: error.message };

  revalidatePath("/configuracoes/modelos-contrato");
  return { cd_modelo: (data as string | null) ?? input.cd_modelo ?? "" };
}

export async function alternarAtivoModelo(cd_modelo: string, sn_ativo: boolean) {
  const supabase = await createClient();
  await supabase.schema("soma").rpc("fn_arquivar_modelo_contrato", {
    p_cd_modelo: cd_modelo,
    p_sn_ativo: sn_ativo,
  });
  revalidatePath("/configuracoes/modelos-contrato");
}

export async function excluirModelo(cd_modelo: string): Promise<{ erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.schema("soma").rpc("fn_excluir_modelo_contrato", {
    p_cd_modelo: cd_modelo,
  });
  if (error) return { erro: error.message };
  revalidatePath("/configuracoes/modelos-contrato");
  return {};
}

// Cópia de um modelo existente (com " (cópia)" no nome) — ponto de
// partida pra um modelo parecido, sem mexer no original.
export async function duplicarModelo(cd_modelo: string): Promise<ModeloState> {
  const supabase = await createClient();
  const { data: original } = await supabase
    .schema("soma")
    .from("modelos_contrato")
    .select("nm_modelo, ds_descricao, ds_conteudo")
    .eq("cd_modelo", cd_modelo)
    .maybeSingle<{ nm_modelo: string; ds_descricao: string | null; ds_conteudo: string }>();
  if (!original) return { erro: "Modelo não encontrado." };

  return salvarModelo({
    cd_modelo: null,
    nm_modelo: `${original.nm_modelo} (cópia)`.slice(0, 120),
    ds_descricao: original.ds_descricao ?? "",
    ds_conteudo: original.ds_conteudo,
  });
}

// Lê um arquivo Word e devolve o texto pra abrir no editor (nada é salvo ainda).
export async function importarModeloDocx(
  formData: FormData
): Promise<{ erro: string } | { texto: string; nome: string }> {
  const usuario = await getUsuarioAtual();
  if (!PODE_EDITAR.has(usuario.tp_role)) return { erro: "Só Master ou Jurídico cria modelo." };

  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo." };
  if (!/\.docx$/i.test(arquivo.name)) {
    return { erro: "Envie um arquivo Word no formato .docx (no Word: Salvar como › Documento do Word)." };
  }

  try {
    const texto = docxParaTexto(new Uint8Array(await arquivo.arrayBuffer()));
    if (texto.trim().length < 10) return { erro: "Não encontrei texto neste arquivo." };
    return { texto, nome: arquivo.name.replace(/\.docx$/i, "") };
  } catch (erro) {
    console.error("[modelos] falha ao ler o .docx:", erro);
    return { erro: erro instanceof Error ? erro.message : "Não foi possível ler o arquivo." };
  }
}

// Gera o texto do modelo SALVO com os dados de um processo real (marcando em vermelho o que veio do
// processo) — pra testar o modelo antes de usar.
export async function previaDoModelo(
  cd_modelo: string,
  cd_processo: string
): Promise<{ erro: string } | { texto: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("soma").rpc("fn_render_modelo_contrato", {
    p_cd_processo: cd_processo,
    p_cd_modelo: cd_modelo,
    p_marcar: true,
  });
  if (error || typeof data !== "string") {
    return { erro: error?.message ?? "Não foi possível gerar a prévia." };
  }
  return { texto: data };
}

// Assistente de IA do editor: sugere trocas pontuais no texto (nada é gravado — a pessoa revisa e
// aplica na tela). "campos": troca dados fixos de um contrato preenchido pelos {{campos}}.
// "instrucao": faz a mudança pedida em linguagem natural.
export async function sugerirComIA(
  texto: string,
  modo: "campos" | "instrucao",
  instrucao?: string
): Promise<SugestoesModelo | { erro: string }> {
  const usuario = await getUsuarioAtual();
  if (!PODE_EDITAR.has(usuario.tp_role)) return { erro: "Só Master ou Jurídico usa o assistente." };
  return sugerirEdicoesModelo({ texto, modo, instrucao });
}
