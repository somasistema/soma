import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Minuta, Processo } from "@/types/database";
import { getProvedorAssinatura } from "./index";
import { minutaTextoParaPdf } from "./minuta-pdf";
import { resolverSignatarios } from "./signatarios";
import type { ArquivoParaAssinar } from "./tipos";

const BUCKET_MINUTAS = "minutas";

export type ResultadoEnvio = { enviado: boolean; erro?: string; naoConfigurado?: boolean };

function tipoPorNome(nome: string): string {
  const ext = nome.toLowerCase().split(".").pop();
  if (ext === "pdf") return "application/pdf";
  if (ext === "doc") return "application/msword";
  if (ext === "docx")
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "application/octet-stream";
}

// Envia o contrato final pra assinatura das 5 frentes. Idempotente
// (não reenvia se já tem documento no provedor). Nunca lança — devolve
// o erro pra quem chamou registrar/mostrar. Roda com service_role.
export async function enviarContratoParaAssinatura(cdContrato: string): Promise<ResultadoEnvio> {
  const provedor = getProvedorAssinatura();
  if (!provedor) {
    return { enviado: false, naoConfigurado: true };
  }

  const supabase = createServiceRoleClient();

  const { data: contrato } = await supabase
    .schema("soma")
    .from("contratos")
    .select("cd_contrato, cd_processo, cd_minuta, tp_status, ds_documento_externo_id")
    .eq("cd_contrato", cdContrato)
    .maybeSingle();

  if (!contrato) return { enviado: false, erro: "Contrato não encontrado." };
  if (contrato.ds_documento_externo_id) return { enviado: true }; // já enviado

  const [{ data: minuta }, { data: processo }] = await Promise.all([
    supabase
      .schema("soma")
      .from("minutas")
      .select("*")
      .eq("cd_minuta", contrato.cd_minuta)
      .maybeSingle<Minuta>(),
    supabase
      .schema("soma")
      .from("processos")
      .select("*")
      .eq("cd_processo", contrato.cd_processo)
      .maybeSingle<Processo>(),
  ]);

  if (!minuta || !processo) {
    return { enviado: false, erro: "Minuta ou processo do contrato não encontrado." };
  }

  const titulo = `Contrato ${processo.ds_numero_processo}`;

  try {
    let arquivo: ArquivoParaAssinar;
    if (minuta.ds_storage_url) {
      const { data: blob, error } = await supabase.storage
        .from(BUCKET_MINUTAS)
        .download(minuta.ds_storage_url);
      if (error || !blob) throw new Error(`Falha ao baixar a minuta: ${error?.message ?? "?"}`);
      const nome = minuta.ds_storage_url.split("/").pop() || "minuta.pdf";
      arquivo = {
        nome,
        conteudo: Buffer.from(await blob.arrayBuffer()),
        tipo: blob.type || tipoPorNome(nome),
      };
    } else if (minuta.ds_conteudo) {
      arquivo = {
        nome: `contrato-${processo.ds_numero_processo}.pdf`,
        conteudo: await minutaTextoParaPdf(titulo, minuta.ds_conteudo),
        tipo: "application/pdf",
      };
    } else {
      throw new Error("Minuta sem arquivo nem conteúdo.");
    }

    const signatarios = await resolverSignatarios(supabase, processo, minuta);
    const criado = await provedor.criarDocumento({ titulo, arquivo, signatarios });

    const linhas = signatarios.map((s) => {
      const ref = criado.signatarios.find((c) => c.tp_papel === s.tp_papel);
      return {
        cd_contrato: cdContrato,
        tp_papel: s.tp_papel,
        cd_usuario: s.cd_usuario,
        nm_signatario: s.nome,
        ds_email: s.email,
        ds_assinatura_externo_id: ref?.assinaturaExternoId ?? null,
        ds_url_assinatura: ref?.urlAssinatura ?? null,
      };
    });

    await supabase.schema("soma").from("contrato_signatarios").insert(linhas);

    await supabase
      .schema("soma")
      .from("contratos")
      .update({
        tp_status: "enviado",
        ds_provedor_assinatura: provedor.nome,
        ds_documento_externo_id: criado.documentoExternoId,
        ds_url_documento: criado.urlDocumento,
        ds_erro_envio: null,
        ts_envio_assinatura: new Date().toISOString(),
      })
      .eq("cd_contrato", cdContrato);

    await supabase.schema("soma").rpc("fn_registrar_andamento", {
      p_cd_processo: contrato.cd_processo,
      p_nm_etapa: "Contrato enviado para assinatura",
      p_ds_andamento: `Contrato enviado para assinatura digital das 5 frentes via ${provedor.nome}.`,
    });

    return { enviado: true };
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    console.error("[assinatura] falha ao enviar contrato", cdContrato, mensagem);
    await supabase
      .schema("soma")
      .from("contratos")
      .update({ ds_erro_envio: mensagem.slice(0, 500) })
      .eq("cd_contrato", cdContrato);
    return { enviado: false, erro: mensagem };
  }
}
