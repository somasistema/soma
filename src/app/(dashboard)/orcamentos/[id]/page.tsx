import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import type { Orcamento, OrcamentoServico, Processo } from "@/types/database";
import { CopyLinkButton } from "./copy-link-button";

export default async function OrcamentoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: orcamento } = await supabase
    .schema("soma")
    .from("orcamentos")
    .select("*")
    .eq("cd_orcamento", id)
    .single<Orcamento>();

  if (!orcamento) {
    notFound();
  }

  const [{ data: processo }, { data: itens }] = await Promise.all([
    supabase
      .schema("soma")
      .from("processos")
      .select("*")
      .eq("cd_processo", orcamento.cd_processo)
      .single<Processo>(),
    supabase
      .schema("soma")
      .from("orcamento_servicos")
      .select("*")
      .eq("cd_orcamento", orcamento.cd_orcamento)
      .returns<OrcamentoServico[]>(),
  ]);

  // NEXT_PUBLIC_VERCEL_URL é injetada automaticamente pela Vercel em todo
  // deploy (preview e produção) com o domínio real, sem precisar configurar
  // manualmente. Só não existe rodando local (`npm run dev`), daí o fallback
  // final pro localhost:3000.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000");
  const linkAceite = `${siteUrl}/aceite/${orcamento.cd_token_aceite}`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
          Processo {processo?.ds_numero_processo}
        </h1>
        <StatusBadge status={orcamento.tp_status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Itens do orçamento</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Serviço</th>
                <th className="py-2 font-medium">Tipo</th>
                <th className="py-2 font-medium">Qtd.</th>
                <th className="py-2 font-medium">Valor unit.</th>
                <th className="py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(itens ?? []).map((item) => (
                <tr key={item.cd_orcamento_servico} className="border-t border-border">
                  <td className="py-2">{item.ds_descricao}</td>
                  <td className="py-2">
                    {item.tp_servico === "honorario" ? "Honorário" : "Custa"}
                  </td>
                  <td className="py-2">{item.nr_quantidade}</td>
                  <td className="py-2">{formatarMoeda(item.vl_unitario)}</td>
                  <td className="py-2 text-right">{formatarMoeda(item.vl_subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
            <p className="text-muted-foreground">
              Honorários: {formatarMoeda(orcamento.vl_total_honorarios)}
            </p>
            <p className="text-muted-foreground">
              Custas: {formatarMoeda(orcamento.vl_total_custas)}
            </p>
            <p className="font-serif-doc text-lg font-semibold text-foreground">
              Total: {formatarMoeda(orcamento.vl_total_geral)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Link de aceite</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {linkAceite}
          </code>
          <CopyLinkButton link={linkAceite} />
        </CardContent>
      </Card>
    </div>
  );
}
