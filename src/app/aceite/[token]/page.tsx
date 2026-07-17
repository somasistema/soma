import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { createPublicClient } from "@/lib/supabase/public";
import { formatarData, formatarMoeda } from "@/lib/utils";
import { TIPO_PROCESSO_LABEL, type OrcamentoAceite, type StatusOrcamento } from "@/types/database";
import { AceiteButton } from "./aceite-button";

const MENSAGEM_STATUS: Partial<Record<StatusOrcamento, string>> = {
  aceito: "Você já aceitou este orçamento.",
  pago: "Este orçamento já foi pago.",
  liberado: "Este orçamento já foi liberado.",
  reprovado: "Este orçamento foi reprovado.",
};

export default async function AceitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Página pública, nunca há sessão — client anon direto. A RPC é
  // SECURITY DEFINER e resolve o orçamento pelo próprio token.
  const supabase = createPublicClient();
  const { data } = await supabase
    .schema("soma")
    .rpc("fn_obter_orcamento_por_token", { p_token: token });

  const orcamento = data as OrcamentoAceite | null;

  if (!orcamento) {
    notFound();
  }

  const hoje = new Date().toISOString().slice(0, 10);
  const vencido = orcamento.dt_validade < hoje;

  return (
    <div className="flex min-h-screen justify-center bg-muted px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-serif-doc text-lg font-semibold text-brand">SOMA</p>
            <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
              Processo {orcamento.processo.ds_numero_processo}
            </h1>
            <p className="text-sm text-muted-foreground">
              {TIPO_PROCESSO_LABEL[orcamento.processo.tp_processo]} — {orcamento.nm_cidade}
            </p>
          </div>
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
                {orcamento.itens.map((item, index) => (
                  <tr key={index} className="border-t border-border">
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

            <p className="mt-4 text-sm text-muted-foreground">
              Válido até {formatarData(orcamento.dt_validade)}.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aceite</CardTitle>
          </CardHeader>
          <CardContent>
            {orcamento.tp_status === "pendente" && !vencido && <AceiteButton token={token} />}
            {orcamento.tp_status === "pendente" && vencido && (
              <p className="text-sm text-status-reprovado">
                Este orçamento venceu em {formatarData(orcamento.dt_validade)}.
              </p>
            )}
            {orcamento.tp_status !== "pendente" && (
              <p className="text-sm text-muted-foreground">
                {MENSAGEM_STATUS[orcamento.tp_status]}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
