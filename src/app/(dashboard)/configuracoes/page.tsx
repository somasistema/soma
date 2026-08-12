import { History, MapPin, PackageOpen, ShieldCheck, Workflow } from "lucide-react";
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
      <Link href="/configuracoes/cidades">
        <Card className="h-full transition-colors hover:border-brand">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <MapPin className="h-5 w-5 text-accent" />
            <CardTitle>Cidades</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Cidades disponíveis pra orçamento e preço de serviço — adicione, desative ou
              exclua.
            </p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/configuracoes/pacotes">
        <Card className="h-full transition-colors hover:border-brand">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <PackageOpen className="h-5 w-5 text-accent" />
            <CardTitle>Pacotes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Vincule taxas e emolumentos a um serviço — ao adicionar o serviço no orçamento, eles
              entram junto automaticamente.
            </p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/configuracoes/perfil-acesso">
        <Card className="h-full transition-colors hover:border-brand">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <CardTitle>Perfil de acesso</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Escolha quais seções do menu cada perfil (Jurídico, Imobiliária, Despachante...)
              pode acessar.
            </p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/configuracoes/auditoria">
        <Card className="h-full transition-colors hover:border-brand">
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <History className="h-5 w-5 text-accent" />
            <CardTitle>Auditoria</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Toda mudança feita no sistema — quem fez, o que mudou e quando. Só Master vê.
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
