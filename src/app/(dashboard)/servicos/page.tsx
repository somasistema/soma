import { Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import type { Servico } from "@/types/database";
import { ServicoForm } from "./servico-form";
import { ToggleAtivo } from "./toggle-ativo";

export default async function ServicosPage() {
  const usuario = await getUsuarioAtual();

  if (usuario.tp_role !== "master") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: servicos } = await supabase
    .schema("soma")
    .from("servicos")
    .select("*")
    .order("nm_servico")
    .returns<Servico[]>();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-serif-doc text-2xl font-semibold text-foreground">
        <Settings className="h-6 w-6 text-accent" />
        Serviços
      </h1>
      <ServicoForm />
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(servicos ?? []).map((servico) => (
              <tr key={servico.cd_servico} className="border-t border-border hover:bg-muted/50">
                <td className="px-4 py-3">{servico.nm_servico}</td>
                <td className="px-4 py-3">
                  {servico.tp_servico === "honorario" ? "Honorário" : "Custa"}
                </td>
                <td className="px-4 py-3">{formatarMoeda(servico.vl_servico)}</td>
                <td className="px-4 py-3">
                  <AtivoBadge ativo={servico.sn_ativo} />
                </td>
                <td className="px-4 py-3 text-right">
                  <ToggleAtivo cd_servico={servico.cd_servico} sn_ativo={servico.sn_ativo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
