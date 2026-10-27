import { NextResponse } from "next/server";
import { minutaParaPdf } from "@/lib/assinatura/minuta-pdf";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Minuta } from "@/types/database";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PDF da minuta do convite. Quem tem o token (link do e-mail) lê a versão
// que o convite aponta — a credencial é o próprio token, que ninguém adivinha.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!UUID.test(token)) return new NextResponse("Link inválido.", { status: 404 });

  const supabase = createServiceRoleClient();

  const { data: convite } = await supabase
    .schema("soma")
    .from("minuta_convites")
    .select("cd_minuta")
    .eq("cd_convite", token)
    .maybeSingle();
  if (!convite) return new NextResponse("Link inválido.", { status: 404 });

  const { data: minuta } = await supabase
    .schema("soma")
    .from("minutas")
    .select("*, processos(ds_numero_processo)")
    .eq("cd_minuta", convite.cd_minuta)
    .maybeSingle<Minuta & { processos: { ds_numero_processo: string } | null }>();
  if (!minuta) return new NextResponse("Minuta não encontrada.", { status: 404 });

  const numero = minuta.processos?.ds_numero_processo ?? "contrato";

  if (!minuta.ds_conteudo && !minuta.ds_conteudo_json) {
    if (!minuta.ds_storage_url) return new NextResponse("Minuta sem conteúdo.", { status: 404 });
    const { data } = await supabase.storage
      .from("minutas")
      .createSignedUrl(minuta.ds_storage_url, 60 * 10);
    if (!data?.signedUrl) return new NextResponse("Não foi possível abrir o arquivo.", { status: 404 });
    return NextResponse.redirect(data.signedUrl);
  }

  // Quem lê pra aprovar vê o que veio dos dados do processo em vermelho.
  const pdf = await minutaParaPdf(minuta, { destacar: true });
  if (!pdf) return new NextResponse("Minuta sem conteúdo.", { status: 404 });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="minuta-${numero}-v${minuta.nr_versao}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
