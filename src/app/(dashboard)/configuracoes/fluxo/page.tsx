import { createClient } from "@/lib/supabase/server";
import type { FluxoBloco } from "@/types/database";
import { FluxoCanvas } from "./fluxo-canvas";

export default async function FluxoPage() {
  const supabase = await createClient();

  const { data: blocos } = await supabase
    .schema("soma")
    .from("fluxo_blocos")
    .select("*")
    .returns<FluxoBloco[]>();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Arraste os blocos pra reorganizar o desenho do fluxo. O interruptor em cada bloco
        controla se ele aparece de verdade na tela de novo orçamento — desativar aqui remove o
        passo de lá na hora.
      </p>
      <FluxoCanvas blocosIniciais={blocos ?? []} />
    </div>
  );
}
