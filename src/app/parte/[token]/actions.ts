"use server";

import { randomUUID } from "node:crypto";
import { lerDocumento } from "@/lib/ocr/ler-documento";
import { processarOcr } from "@/lib/ocr/processar";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sanitizarNomeArquivo } from "@/lib/utils";
import { CATEGORIA_DOC_INTAKE_LABEL, type CategoriaDocIntake, type ParteAutoatendimento } from "@/types/database";

// preenchido: dados que a leitura do documento completou na própria pessoa
// (a tela mostra na hora, sem o cliente redigitar).
export type DadosPreenchidos = Partial<{
  nm_parte: string;
  ds_cpf: string;
  ds_rg: string;
  dt_nascimento: string;
  ds_endereco: string;
}>;

export type ParteActionState =
  | { sucesso: true; preenchido?: DadosPreenchidos }
  | { sucesso: false; erro: string };

const MARCA_NOME_PROVISORIO = "aguardando preenchimento";

// dd/mm/aaaa -> aaaa-mm-dd
function dataIso(valor: string | undefined) {
  const m = valor?.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

type CampoLidoSimples = { nm_campo: string; ds_valor: string };
type DadosAtuais = {
  nm_parte: string | null;
  ds_cpf: string | null;
  ds_rg: string | null;
  dt_nascimento: string | null;
  ds_endereco: string | null;
};

// O que a leitura do documento completa: só o que ainda está vazio.
function montarPatch(
  categoria: string,
  campos: CampoLidoSimples[],
  atual: DadosAtuais
): DadosPreenchidos {
  const get = (nome: string) => campos.find((c) => c.nm_campo === nome)?.ds_valor?.trim();
  const patch: DadosPreenchidos = {};

  if (categoria === "identidade") {
    const nome = get("nome");
    if (nome && (!atual.nm_parte || atual.nm_parte.includes(MARCA_NOME_PROVISORIO))) {
      patch.nm_parte = nome;
    }
    if (!atual.ds_cpf && get("cpf")) patch.ds_cpf = get("cpf");
    if (!atual.ds_rg && get("rg")) patch.ds_rg = get("rg");
    const nasc = dataIso(get("data_nascimento"));
    if (!atual.dt_nascimento && nasc) patch.dt_nascimento = nasc;
  }
  if (categoria === "comprovante_residencia") {
    if (!atual.ds_endereco && get("endereco")) patch.ds_endereco = get("endereco");
  }
  return patch;
}

// Completa, na própria pessoa, só o que ainda está vazio a partir do que a
// leitura achou no documento recém-enviado. Nunca sobrescreve dado digitado.
async function preencherParteComLeitura(
  service: ReturnType<typeof createServiceRoleClient>,
  cdParte: string,
  cdDocumento: string,
  categoria: string
): Promise<DadosPreenchidos> {
  if (categoria !== "identidade" && categoria !== "comprovante_residencia") return {};

  const { data: ocr } = await service
    .schema("soma")
    .from("documento_ocr")
    .select("cd_documento_ocr")
    .eq("cd_documento", cdDocumento)
    .maybeSingle();
  if (!ocr) return {};

  const [{ data: campos }, { data: parte }] = await Promise.all([
    service
      .schema("soma")
      .from("documento_ocr_campos")
      .select("nm_campo, ds_valor")
      .eq("cd_documento_ocr", ocr.cd_documento_ocr),
    service
      .schema("soma")
      .from("processo_parte")
      .select("nm_parte, ds_cpf, ds_rg, dt_nascimento, ds_endereco")
      .eq("cd_parte", cdParte)
      .maybeSingle(),
  ]);
  if (!parte) return {};

  const patch = montarPatch(categoria, campos ?? [], parte);

  if (Object.keys(patch).length > 0) {
    await service.schema("soma").from("processo_parte").update(patch).eq("cd_parte", cdParte);
  }
  return patch;
}

// Página pública — a autorização é o token, revalidado dentro das
// funções SECURITY DEFINER.
export async function salvarMeusDados(
  token: string,
  dados: {
    nm_parte: string;
    ds_telefone: string;
    ds_email: string;
    ds_profissao: string;
    ds_conta_bancaria: string;
    ds_cpf: string;
    ds_rg: string;
    dt_nascimento: string;
    ds_endereco: string;
    sn_uniao_estavel: string; // "true" | "false" | "" (não respondeu)
  }
): Promise<ParteActionState> {
  const supabase = createPublicClient();
  const { error } = await supabase.schema("soma").rpc("fn_atualizar_parte_publico", {
    p_token: token,
    p_dados: dados,
  });
  if (error) {
    return { sucesso: false, erro: error.message || "Não foi possível salvar." };
  }
  return { sucesso: true };
}

const CATEGORIAS_VALIDAS = [
  "identidade",
  "estado_civil",
  "comprovante_residencia",
  "onus_escritura",
  "iptu",
  "uniao_estavel",
  "geral", // documento avulso (papéis sem checklist)
];

// A parte apaga um arquivo que ela mesma mandou (errado, repetido...).
// fn_remover_documento_parte só apaga se o documento for dessa parte.
export async function removerMeuDocumento(
  token: string,
  cdDocumento: string
): Promise<ParteActionState> {
  const service = createServiceRoleClient();
  const { data: caminho, error } = await service
    .schema("soma")
    .rpc("fn_remover_documento_parte", { p_token: token, p_cd_documento: cdDocumento });

  if (error || !caminho) {
    return { sucesso: false, erro: error?.message ?? "Não foi possível remover." };
  }

  await service.storage.from("documentos").remove([caminho as string]);
  return { sucesso: true };
}

export async function anexarMeuDocumento(
  token: string,
  categoria: string,
  formData: FormData
): Promise<ParteActionState> {
  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return { sucesso: false, erro: "Categoria inválida." };
  }
  const arquivo = formData.get("arquivo") as File | null;
  if (!arquivo || arquivo.size === 0) {
    return { sucesso: false, erro: "Selecione um arquivo." };
  }

  // Valida o token e descobre o processo.
  const publico = createPublicClient();
  const { data } = await publico
    .schema("soma")
    .rpc("fn_parte_por_token", { p_token: token });
  const parte = data as ParteAutoatendimento | null;
  if (!parte) {
    return { sucesso: false, erro: "Link inválido." };
  }

  // Upload + registro rodam com service_role (bucket e soma.documentos
  // são bloqueados pra anon).
  const service = createServiceRoleClient();

  // Link gerado antes de o processo existir: o documento fica no convite
  // (e é movido pro processo quando ele for criado).
  if (!parte.cd_processo) {
    const caminhoConvite = `convites/${token}/${randomUUID()}-${sanitizarNomeArquivo(arquivo.name)}`;
    const { error: erroUp } = await service.storage
      .from("documentos")
      .upload(caminhoConvite, arquivo, { contentType: arquivo.type || undefined });
    if (erroUp) return { sucesso: false, erro: erroUp.message };

    const { data: cdConviteDoc, error: erroReg } = await service
      .schema("soma")
      .rpc("fn_registrar_documento_parte", {
        p_token: token,
        p_categoria: categoria,
        p_nm_arquivo: arquivo.name,
        p_storage_url: caminhoConvite,
      });
    if (erroReg || !cdConviteDoc) {
      await service.storage.from("documentos").remove([caminhoConvite]);
      return { sucesso: false, erro: erroReg?.message ?? "Não foi possível registrar o documento." };
    }

    try {
      const leitura = await lerDocumento({
        arquivo: await arquivo.arrayBuffer(),
        contentType: arquivo.type || null,
        nomeArquivo: arquivo.name,
        categoria,
        rotuloTipo: CATEGORIA_DOC_INTAKE_LABEL[categoria as CategoriaDocIntake] ?? categoria,
      });
      await service
        .schema("soma")
        .from("convite_documentos")
        .update({
          tp_documento_detectado: leitura.tipoDetectado,
          nr_confianca: leitura.confianca,
          ds_campos: leitura.campos,
        })
        .eq("cd_convite_documento", cdConviteDoc);

      const { data: atual } = await service
        .schema("soma")
        .from("convites_parte")
        .select("nm_parte, ds_cpf, ds_rg, dt_nascimento, ds_endereco")
        .eq("cd_convite", token)
        .maybeSingle();
      const patch = atual ? montarPatch(categoria, leitura.campos, atual) : {};
      if (Object.keys(patch).length > 0) {
        await service
          .schema("soma")
          .from("convites_parte")
          .update({ ...patch, ts_atualizacao: new Date().toISOString() })
          .eq("cd_convite", token);
      }
      return { sucesso: true, preenchido: patch };
    } catch (erro) {
      // O arquivo ficou guardado; só a leitura falhou.
      console.error("[convite] falha na leitura:", erro);
      return { sucesso: true };
    }
  }
  const caminho = `${parte.cd_processo}/${randomUUID()}-${sanitizarNomeArquivo(arquivo.name)}`;

  const { error: erroUpload } = await service.storage
    .from("documentos")
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined });
  if (erroUpload) {
    return { sucesso: false, erro: erroUpload.message };
  }

  const { data: cdDocumento, error: erroRpc } = await service
    .schema("soma")
    .rpc("fn_registrar_documento_parte", {
      p_token: token,
      p_categoria: categoria,
      p_nm_arquivo: arquivo.name,
      p_storage_url: caminho,
    });

  if (erroRpc || !cdDocumento) {
    return { sucesso: false, erro: erroRpc?.message ?? "Não foi possível registrar o documento." };
  }

  await processarOcr(cdDocumento as string);
  const preenchido = await preencherParteComLeitura(
    service,
    parte.cd_parte as string,
    cdDocumento as string,
    categoria
  ).catch(() => ({}));
  return { sucesso: true, preenchido };
}
