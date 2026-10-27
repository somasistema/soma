import { NextResponse, type NextRequest } from "next/server";
import { minutaParaPdf } from "@/lib/assinatura/minuta-pdf";
import type { DocMinuta } from "@/lib/minuta-doc";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// PDF da minuta atual do processo, pra conferir/imprimir. Minuta feita
// de modelo (texto) vira PDF na hora, sem as marcas de vermelho;
// minuta que já é arquivo redireciona pro arquivo. A leitura respeita a
// RLS: quem não enxerga a minuta recebe 404.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new NextResponse("Sessão expirada.", { status: 401 });
  }

  const { data: minuta } = await supabase
    .schema("soma")
    .from("minutas")
    .select("nr_versao, ds_conteudo, ds_conteudo_json, ds_storage_url, processos(ds_numero_processo)")
    .eq("cd_processo", id)
    .order("nr_versao", { ascending: false })
    .limit(1)
    .maybeSingle<{
      nr_versao: number;
      ds_conteudo: string | null;
      ds_conteudo_json: DocMinuta | null;
      ds_storage_url: string | null;
      processos: { ds_numero_processo: string } | null;
    }>();

  if (!minuta) {
    return new NextResponse("Minuta não encontrada.", { status: 404 });
  }

  if (!minuta.ds_conteudo) {
    if (!minuta.ds_storage_url) {
      return new NextResponse("Minuta sem conteúdo.", { status: 404 });
    }
    const { data } = await supabase.storage
      .from("minutas")
      .createSignedUrl(minuta.ds_storage_url, 60 * 10);
    if (!data?.signedUrl) {
      return new NextResponse("Não foi possível abrir o arquivo.", { status: 404 });
    }
    return NextResponse.redirect(data.signedUrl);
  }

  const numero = minuta.processos?.ds_numero_processo ?? id;
  const baixar = new URL(request.url).searchParams.get("baixar") === "1";
  // "Abrir" é pra conferir (valores do processo em vermelho); "Baixar" sai limpo.
  const pdf = await minutaParaPdf(minuta, { destacar: !baixar });
  if (!pdf) {
    return new NextResponse("Minuta sem conteúdo.", { status: 404 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename="minuta-${numero}-v${minuta.nr_versao}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
