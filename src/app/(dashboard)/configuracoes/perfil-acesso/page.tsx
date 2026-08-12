import { createClient } from "@/lib/supabase/server";
import type { PerfilAcesso } from "@/types/database";
import { PerfilAcessoMatriz } from "./perfil-acesso-matriz";

export default async function PerfilAcessoPage() {
  const supabase = await createClient();

  const { data: acessos } = await supabase
    .schema("soma")
    .from("perfil_acesso")
    .select("*")
    .returns<PerfilAcesso[]>();

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Início e Configurações só têm liga/desliga de acesso. Orçamentos, Processos, Usuários,
        Serviços e Taxas e Emolumentos têm controle fino de Ver/Criar/Editar/Excluir. Master não
        aparece aqui — sempre tem acesso total, pra ninguém se trancar fora desta própria tela.
      </p>
      <PerfilAcessoMatriz acessos={acessos ?? []} />
    </div>
  );
}
