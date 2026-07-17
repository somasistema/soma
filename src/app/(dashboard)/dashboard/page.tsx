import { FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getUsuarioAtual } from "@/lib/auth";
import { ROLE_LABEL } from "@/types/database";

export default async function DashboardPage() {
  const usuario = await getUsuarioAtual();

  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/5 text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
              Olá, {usuario.nm_usuario}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Você está conectado como {ROLE_LABEL[usuario.tp_role]}.
            </p>
          </div>
        </div>
        {(usuario.tp_role === "master" || usuario.tp_role === "juridico") && (
          <Link
            href="/orcamentos"
            className={buttonVariants({ variant: "outline" }) + " gap-2"}
          >
            <FileText className="h-4 w-4" />
            Ver orçamentos
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
