import { ArrowRight, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { ROLE_LABEL, type RoleUsuario } from "@/types/database";
import { login, loginDemo } from "./actions";

const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

// Só a conta Master está seedada hoje; os demais perfis ficam desabilitados
// até essas contas serem criadas — não inventar credenciais aqui.
const DEMO_PERFIS: { role: RoleUsuario; disponivel: boolean }[] = [
  { role: "master", disponivel: true },
  { role: "despachante", disponivel: false },
  { role: "juridico", disponivel: false },
  { role: "imobiliaria", disponivel: false },
  { role: "corretor", disponivel: false },
  { role: "vendedor", disponivel: false },
  { role: "comprador", disponivel: false },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <Logo size="lg" stacked />

        <p className="-mt-4 text-center text-sm text-muted-foreground">
          Bem-vindo à sua plataforma de gestão inteligente.
        </p>

        <Card className="w-full">
          <CardContent className="pt-6">
            <form action={login} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="border-transparent bg-muted pl-9"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="senha">Senha</Label>
                  <span
                    aria-disabled
                    className="pointer-events-none text-xs font-medium uppercase tracking-wide text-accent opacity-70"
                  >
                    Esqueci a senha
                  </span>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="senha"
                    name="senha"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="border-transparent bg-muted pl-9"
                  />
                </div>
              </div>

              {erro && <p className="text-sm text-status-reprovado">{erro}</p>}

              <Button
                type="submit"
                className="mt-2 w-full uppercase tracking-wide"
              >
                Entrar no sistema
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {DEMO_ENABLED && (
          <Card className="w-full">
            <CardContent className="flex flex-col gap-3 pt-6">
              <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Demonstração
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_PERFIS.map(({ role, disponivel }) =>
                  disponivel ? (
                    <form key={role} action={loginDemo}>
                      <input type="hidden" name="perfil" value={role} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="w-full justify-center"
                      >
                        {ROLE_LABEL[role]}
                      </Button>
                    </form>
                  ) : (
                    <Button
                      key={role}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled
                      title="Conta demo ainda não criada"
                      className="w-full justify-center"
                    >
                      {ROLE_LABEL[role]}
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
