import { Mail } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { FadeIn } from "@/components/motion/fade-in";
import { solicitarRecuperacaoSenha } from "./actions";

export default async function EsqueciSenhaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; enviado?: string }>;
}) {
  const { erro, enviado } = await searchParams;

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-4 py-10">
      <FadeIn className="flex w-full max-w-sm flex-col items-center gap-8">
        <Logo size="lg" tagline={false} />

        <Card className="w-full">
          <CardContent className="pt-6">
            {enviado ? (
              <p className="text-center text-sm text-muted-foreground">
                Se esse e-mail estiver cadastrado, você vai receber um link pra redefinir a senha
                em instantes. Confira também a caixa de spam.
              </p>
            ) : (
              <form action={solicitarRecuperacaoSenha} className="flex flex-col gap-4">
                <p className="text-center text-sm text-muted-foreground">
                  Informe o e-mail da sua conta pra receber um link de redefinição de senha.
                </p>
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

                {erro && <p className="text-sm text-status-reprovado">{erro}</p>}

                <Button type="submit" className="mt-2 w-full uppercase tracking-wide">
                  Enviar link de redefinição
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Link href="/login" className="text-xs font-medium uppercase tracking-wide text-accent">
          Voltar pro login
        </Link>
      </FadeIn>
    </div>
  );
}
