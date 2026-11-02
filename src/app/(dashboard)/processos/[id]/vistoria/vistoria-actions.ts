"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { descreverAmbienteComIA } from "@/lib/vistoria/descrever";

export type VistoriaState = { sucesso: true } | { sucesso: false; erro: string };
export type DescricaoState = { sucesso: true; texto: string } | { sucesso: false; erro: string };

const BUCKET = "documentos";
const PODE = new Set(["master", "juridico"]);

async function exigirEquipe() {
  const usuario = await getUsuarioAtual();
  if (!PODE.has(usuario.tp_role)) throw new Error("Só Master ou Jurídico mexe na vistoria.");
}

// Os dados vão pelo service_role (a tabela só tem leitura pela RLS); a checagem de
// perfil acima é a barreira. O ambiente precisa pertencer ao processo informado.
async function ambienteDoProcesso(
  service: ReturnType<typeof createServiceRoleClient>,
  cdProcesso: string,
  cdAmbiente: string
) {
  const { data } = await service
    .schema("soma")
    .from("vistoria_ambientes")
    .select("cd_ambiente, nm_ambiente")
    .eq("cd_ambiente", cdAmbiente)
    .eq("cd_processo", cdProcesso)
    .maybeSingle();
  return data;
}

function erro(e: unknown): { sucesso: false; erro: string } {
  return { sucesso: false, erro: e instanceof Error ? e.message : "Não foi possível concluir." };
}

export async function criarAmbiente(cdProcesso: string, nome: string): Promise<VistoriaState> {
  try {
    await exigirEquipe();
    const limpo = nome.trim();
    if (!limpo) return { sucesso: false, erro: "Informe o nome do ambiente." };
    const service = createServiceRoleClient();
    const { data: ultimo } = await service
      .schema("soma")
      .from("vistoria_ambientes")
      .select("nr_ordem")
      .eq("cd_processo", cdProcesso)
      .order("nr_ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await service
      .schema("soma")
      .from("vistoria_ambientes")
      .insert({ cd_processo: cdProcesso, nm_ambiente: limpo.slice(0, 120), nr_ordem: (ultimo?.nr_ordem ?? -1) + 1 });
    if (error) return { sucesso: false, erro: error.message };
    revalidatePath(`/processos/${cdProcesso}/vistoria`);
    return { sucesso: true };
  } catch (e) {
    return erro(e);
  }
}

export async function salvarAmbiente(
  cdProcesso: string,
  cdAmbiente: string,
  nome: string,
  descricao: string
): Promise<VistoriaState> {
  try {
    await exigirEquipe();
    if (!nome.trim()) return { sucesso: false, erro: "O ambiente precisa de um nome." };
    const service = createServiceRoleClient();
    if (!(await ambienteDoProcesso(service, cdProcesso, cdAmbiente))) {
      return { sucesso: false, erro: "Ambiente não encontrado." };
    }
    const { error } = await service
      .schema("soma")
      .from("vistoria_ambientes")
      .update({ nm_ambiente: nome.trim().slice(0, 120), ds_descricao: descricao.trim() || null })
      .eq("cd_ambiente", cdAmbiente);
    if (error) return { sucesso: false, erro: error.message };
    revalidatePath(`/processos/${cdProcesso}/vistoria`);
    return { sucesso: true };
  } catch (e) {
    return erro(e);
  }
}

export async function excluirAmbiente(cdProcesso: string, cdAmbiente: string): Promise<VistoriaState> {
  try {
    await exigirEquipe();
    const service = createServiceRoleClient();
    if (!(await ambienteDoProcesso(service, cdProcesso, cdAmbiente))) {
      return { sucesso: false, erro: "Ambiente não encontrado." };
    }
    const { data: fotos } = await service
      .schema("soma")
      .from("vistoria_fotos")
      .select("ds_storage_url")
      .eq("cd_ambiente", cdAmbiente);
    if (fotos && fotos.length > 0) {
      await service.storage.from(BUCKET).remove(fotos.map((f) => f.ds_storage_url));
    }
    const { error } = await service.schema("soma").from("vistoria_ambientes").delete().eq("cd_ambiente", cdAmbiente);
    if (error) return { sucesso: false, erro: error.message };
    revalidatePath(`/processos/${cdProcesso}/vistoria`);
    return { sucesso: true };
  } catch (e) {
    return erro(e);
  }
}

// Uma foto por chamada (o limite do corpo do server action é 10 MB e foto de celular é grande).
// A foto é endireitada e reduzida (JPEG) antes de guardar — o PDF não fica pesado.
export async function enviarFoto(cdProcesso: string, cdAmbiente: string, formData: FormData): Promise<VistoriaState> {
  try {
    await exigirEquipe();
    const arquivo = formData.get("arquivo") as File | null;
    if (!arquivo || arquivo.size === 0) return { sucesso: false, erro: "Selecione uma foto." };
    if (!arquivo.type.startsWith("image/")) return { sucesso: false, erro: "O arquivo precisa ser uma imagem." };

    const service = createServiceRoleClient();
    if (!(await ambienteDoProcesso(service, cdProcesso, cdAmbiente))) {
      return { sucesso: false, erro: "Ambiente não encontrado." };
    }

    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(Buffer.from(await arquivo.arrayBuffer()))
      .rotate()
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 80 })
      .toBuffer();

    const caminho = `${cdProcesso}/vistoria/${cdAmbiente}/${randomUUID()}.jpg`;
    const { error: erroUp } = await service.storage.from(BUCKET).upload(caminho, jpeg, { contentType: "image/jpeg" });
    if (erroUp) return { sucesso: false, erro: erroUp.message };

    const { data: ultima } = await service
      .schema("soma")
      .from("vistoria_fotos")
      .select("nr_ordem")
      .eq("cd_ambiente", cdAmbiente)
      .order("nr_ordem", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { error } = await service
      .schema("soma")
      .from("vistoria_fotos")
      .insert({
        cd_ambiente: cdAmbiente,
        nm_arquivo: arquivo.name.slice(0, 255),
        ds_storage_url: caminho,
        nr_ordem: (ultima?.nr_ordem ?? -1) + 1,
      });
    if (error) {
      await service.storage.from(BUCKET).remove([caminho]);
      return { sucesso: false, erro: error.message };
    }
    revalidatePath(`/processos/${cdProcesso}/vistoria`);
    return { sucesso: true };
  } catch (e) {
    return erro(e);
  }
}

export async function excluirFoto(cdProcesso: string, cdFoto: string): Promise<VistoriaState> {
  try {
    await exigirEquipe();
    const service = createServiceRoleClient();
    const { data: foto } = await service
      .schema("soma")
      .from("vistoria_fotos")
      .select("cd_foto, ds_storage_url, vistoria_ambientes!inner(cd_processo)")
      .eq("cd_foto", cdFoto)
      .eq("vistoria_ambientes.cd_processo", cdProcesso)
      .maybeSingle();
    if (!foto) return { sucesso: false, erro: "Foto não encontrada." };
    await service.storage.from(BUCKET).remove([foto.ds_storage_url]);
    await service.schema("soma").from("vistoria_fotos").delete().eq("cd_foto", cdFoto);
    revalidatePath(`/processos/${cdProcesso}/vistoria`);
    return { sucesso: true };
  } catch (e) {
    return erro(e);
  }
}

// Sugere a descrição pelas fotos já enviadas do ambiente. Não grava: a equipe confere e salva.
export async function descreverPelasFotos(cdProcesso: string, cdAmbiente: string): Promise<DescricaoState> {
  try {
    await exigirEquipe();
    const service = createServiceRoleClient();
    const ambiente = await ambienteDoProcesso(service, cdProcesso, cdAmbiente);
    if (!ambiente) return { sucesso: false, erro: "Ambiente não encontrado." };

    const { data: fotos } = await service
      .schema("soma")
      .from("vistoria_fotos")
      .select("ds_storage_url")
      .eq("cd_ambiente", cdAmbiente)
      .order("nr_ordem");
    const buffers: Buffer[] = [];
    for (const f of fotos ?? []) {
      const { data } = await service.storage.from(BUCKET).download(f.ds_storage_url);
      if (data) buffers.push(Buffer.from(await data.arrayBuffer()));
    }
    const r = await descreverAmbienteComIA(ambiente.nm_ambiente, buffers);
    return "texto" in r ? { sucesso: true, texto: r.texto } : { sucesso: false, erro: r.erro };
  } catch (e) {
    return erro(e);
  }
}
