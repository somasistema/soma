import { Settings } from "lucide-react";
import { exigirAcessoSecao, getUsuarioAtual } from "@/lib/auth";
import { LOCAIS_SERVICO } from "@/types/database";
import { ServicosTabs } from "./servicos-tabs";

export default async function ServicosLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioAtual();
  await exigirAcessoSecao(usuario, "servicos");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-serif-doc text-2xl font-semibold text-foreground">
        <Settings className="h-6 w-6 text-accent" />
        Serviços
      </h1>
      <ServicosTabs locais={LOCAIS_SERVICO} />
      {children}
    </div>
  );
}
