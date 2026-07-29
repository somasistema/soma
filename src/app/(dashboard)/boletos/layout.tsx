import { Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { getUsuarioAtual } from "@/lib/auth";
import { BoletosTabs } from "./boletos-tabs";

export default async function BoletosLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuarioAtual();

  if (usuario.tp_role !== "master") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-serif-doc text-2xl font-semibold text-foreground">
        <Receipt className="h-6 w-6 text-accent" />
        Boleto — Tabelas de Custas
      </h1>
      <p className="text-sm text-muted-foreground">
        Consulta das tabelas oficiais de custas do TJBA (Decreto Judiciário nº 1075/2025,
        vigência 01/01/2026). Só leitura por enquanto — não entra no cálculo do orçamento ainda.
      </p>
      <BoletosTabs />
      {children}
    </div>
  );
}
