"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  anexarDocumentosDeConvites,
  anexarDocumentosRascunho,
  type DocumentoRascunho,
} from "@/lib/documentos-rascunho";
import { createClient } from "@/lib/supabase/server";
import type { CriarProcessoInput, CriarProcessoState } from "../../novo/actions";

// Grava a edição dos dados do processo (fn_atualizar_dados_processo,
// migrations 065 e 074): atualiza as partes pelo cd_parte em vez de recriá-las,
// então documentos e links dos clientes continuam ligados. Quem foi
// adicionado agora pode vir com documentos já lidos (rascunho) e/ou com o
// link do cliente já gerado (convite).
export async function atualizarDadosProcesso(
  cdProcesso: string,
  input: CriarProcessoInput
): Promise<CriarProcessoState> {
  const supabase = await createClient();

  const { error } = await supabase.schema("soma").rpc("fn_atualizar_dados_processo", {
    p_cd_processo: cdProcesso,
    p_cd_imobiliaria: input.cd_imobiliaria || null,
    p_nm_solicitante: input.nm_comprador_convidado,
    p_ds_telefone: input.ds_telefone_comprador_convidado,
    p_negocio: input.negocio,
    p_partes: input.partes.map((p) => {
      // docs/modo só existem na tela. Quem já existe tem o link no banco; o token só segue
      // pra quem foi adicionado agora por link (vira a parte, e o convite é consumido).
      const resto = { ...p };
      delete resto.docs;
      delete resto.modo;
      if (p.modo !== "link" || p.cd_parte) delete resto.cd_token_parte;
      return resto;
    }),
    p_corretores: input.corretores,
  });

  if (error) {
    console.error("Erro ao atualizar dados do processo:", error);
    return { erro: error.message };
  }

  const documentos: DocumentoRascunho[] = [
    ...input.partes.flatMap((p) =>
      p.tp_lado === "vendedor" || p.tp_lado === "comprador"
        ? (p.docs ?? []).map((d) => ({
            ...d,
            lado: p.tp_lado as "vendedor" | "comprador",
            nr_ordem: p.nr_ordem,
          }))
        : []
    ),
    ...(input.documentos_imovel ?? []).map((d) => ({ ...d, lado: "imovel" as const, nr_ordem: 0 })),
  ];

  if (documentos.length > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { falhas } = await anexarDocumentosRascunho(cdProcesso, user.id, documentos);
      // Os dados já foram salvos; falha em anexar fica no log e a pessoa anexa de novo
      // pela aba Documentos.
      if (falhas.length > 0) console.error("[processo] anexos com falha:", falhas);
    }
  }

  // Documentos que o cliente já mandou pelo link de quem foi adicionado agora.
  const { falhas: falhasConvite } = await anexarDocumentosDeConvites(cdProcesso);
  if (falhasConvite.length > 0) console.error("[processo] anexos do link com falha:", falhasConvite);

  revalidatePath(`/processos/${cdProcesso}`, "layout");
  redirect(`/processos/${cdProcesso}/partes`);
}
