import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Corretor } from "@/types/database";
import { CorretorForm } from "./corretor-form";
import { CorretoresLista } from "./corretores-lista";

// Mesma RLS da migration 056: leitura pro time interno, escrita só
// Master e Jurídico.
const PODE_VER = new Set(["master", "juridico", "gerente", "despachante"]);

export default async function CorretoresPage() {
  const usuario = await getUsuarioAtual();
  if (!PODE_VER.has(usuario.tp_role)) {
    redirect("/dashboard");
  }

  const editavel = usuario.tp_role === "master" || usuario.tp_role === "juridico";

  const supabase = await createClient();
  const { data: corretores } = await supabase
    .schema("soma")
    .from("corretores")
    .select("*")
    .order("nm_corretor")
    .returns<Corretor[]>();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Corretores que aparecem como sugestão nos Honorários do novo processo. Quem for digitado
        num processo e ainda não estiver aqui entra sozinho. CPF, CRECI e PIX daqui preenchem a
        minuta ({"{{corretor_1_cpf}}"}, {"{{corretor_1_pix}}"}...).
      </p>
      {editavel && (
        <Card>
          <CardHeader>
            <CardTitle>Novo corretor</CardTitle>
          </CardHeader>
          <CardContent>
            <CorretorForm />
          </CardContent>
        </Card>
      )}
      <CorretoresLista corretores={corretores ?? []} editavel={editavel} />
    </div>
  );
}
