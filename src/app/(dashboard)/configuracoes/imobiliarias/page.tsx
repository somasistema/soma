import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Imobiliaria } from "@/types/database";
import { ImobiliariaForm } from "./imobiliaria-form";
import { ImobiliariasLista } from "./imobiliarias-lista";

// RLS de soma.imobiliarias: Master e Jurídico gravam.
const PODE_VER = new Set(["master", "juridico", "gerente", "despachante"]);

export default async function ImobiliariasPage() {
  const usuario = await getUsuarioAtual();
  if (!PODE_VER.has(usuario.tp_role)) {
    redirect("/dashboard");
  }

  const editavel = usuario.tp_role === "master" || usuario.tp_role === "juridico";

  const supabase = await createClient();
  const { data: imobiliarias } = await supabase
    .schema("soma")
    .from("imobiliarias")
    .select("*")
    .order("nm_imobiliaria")
    .returns<Imobiliaria[]>();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Imobiliárias que aparecem no novo processo. Razão social, CNPJ, CRECI-PJ e endereço entram
        na qualificação do contrato. Quem não deve aparecer na lista (ex: sem CRECI), desative.
      </p>
      {editavel && (
        <Card>
          <CardHeader>
            <CardTitle>Nova imobiliária</CardTitle>
          </CardHeader>
          <CardContent>
            <ImobiliariaForm />
          </CardContent>
        </Card>
      )}
      <ImobiliariasLista imobiliarias={imobiliarias ?? []} editavel={editavel} />
    </div>
  );
}
