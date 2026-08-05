import { Settings2 } from "lucide-react";
import { exigirAcessoSecao, getUsuarioAtual } from "@/lib/auth";

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioAtual();
  await exigirAcessoSecao(usuario, "configuracoes");

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-serif-doc text-2xl font-semibold text-foreground">
        <Settings2 className="h-6 w-6 text-accent" />
        Configurações
      </h1>
      {children}
    </div>
  );
}
