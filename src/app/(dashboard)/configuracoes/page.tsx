import { Workflow } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConfiguracoesPage() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Link href="/configuracoes/fluxo">
        <Card className="h-full transition-colors hover:border-brand">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Workflow className="h-5 w-5 text-accent" />
            <CardTitle>Fluxo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Editor visual dos blocos da tela de novo orçamento — arraste pra reorganizar e
              desative o que não quiser que apareça.
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
