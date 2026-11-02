import { NextResponse, type NextRequest } from "next/server";
import { vistoriaParaPdf, type AmbienteVistoria } from "@/lib/assinatura/minuta-pdf";
import { textoParaDoc } from "@/lib/minuta-doc";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const NOME_MODELO = "Termo de vistoria — locação";
const MARCA = "[[AMBIENTES]]";

// PDF do Termo de Vistoria: o texto do modelo (qualificação, imóvel, cláusulas) com os dados do
// processo, e os ambientes cadastrados — descrição e fotos — no lugar da marca [[AMBIENTES]].
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Sessão expirada.", { status: 401 });

  const { data: processo } = await supabase
    .schema("soma")
    .from("processos")
    .select("ds_numero_processo, tp_contrato")
    .eq("cd_processo", id)
    .maybeSingle<{ ds_numero_processo: string; tp_contrato: string }>();
  if (!processo || processo.tp_contrato !== "locacao") {
    return new NextResponse("Processo de aluguel não encontrado.", { status: 404 });
  }

  const { data: modelo } = await supabase
    .schema("soma")
    .from("modelos_contrato")
    .select("cd_modelo")
    .eq("nm_modelo", NOME_MODELO)
    .eq("sn_ativo", true)
    .maybeSingle<{ cd_modelo: string }>();
  if (!modelo) {
    return new NextResponse(`Modelo "${NOME_MODELO}" não encontrado (rode a migration 076).`, { status: 404 });
  }

  const { data: texto, error } = await supabase
    .schema("soma")
    .rpc("fn_render_modelo_contrato", { p_cd_processo: id, p_cd_modelo: modelo.cd_modelo, p_marcar: false });
  if (error || typeof texto !== "string") {
    return new NextResponse(error?.message ?? "Não foi possível montar o termo.", { status: 403 });
  }

  const [antes, ...resto] = texto.split(MARCA);
  const depois = resto.join(MARCA);

  const { data: ambientes } = await supabase
    .schema("soma")
    .from("vistoria_ambientes")
    .select("nm_ambiente, ds_descricao, nr_ordem, vistoria_fotos(ds_storage_url, nr_ordem)")
    .eq("cd_processo", id)
    .order("nr_ordem")
    .returns<
      {
        nm_ambiente: string;
        ds_descricao: string | null;
        vistoria_fotos: { ds_storage_url: string; nr_ordem: number }[];
      }[]
    >();

  const service = createServiceRoleClient();
  const lista: AmbienteVistoria[] = [];
  for (const a of ambientes ?? []) {
    const fotos: Buffer[] = [];
    for (const f of [...a.vistoria_fotos].sort((x, y) => x.nr_ordem - y.nr_ordem)) {
      const { data } = await service.storage.from("documentos").download(f.ds_storage_url);
      if (data) fotos.push(Buffer.from(await data.arrayBuffer()));
    }
    lista.push({ nome: a.nm_ambiente, descricao: a.ds_descricao, fotos });
  }

  const pdf = await vistoriaParaPdf({ antes: textoParaDoc(antes), depois: textoParaDoc(depois) }, lista);
  const baixar = new URL(request.url).searchParams.get("baixar") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename="termo-de-vistoria-${processo.ds_numero_processo}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
