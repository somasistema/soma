"use client";

import { Lock } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/logo";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/client";

// Onde o link de convite (soma.auth.admin.inviteUserByEmail) cai. O
// client do Supabase detecta a sessão pelo hash da própria URL
// (detectSessionInUrl, ligado por padrão) — não tem servidor no meio
// aqui, por isso a tela inteira é client-side.
export default function DefinirSenhaPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [carregando, setCarregando] = useState(true);
  const [sessaoValida, setSessaoValida] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_evento, session) => {
      if (session) setSessaoValida(true);
      setCarregando(false);
    });

    // Se a sessão já tinha sido detectada antes deste efeito montar.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessaoValida(true);
      setCarregando(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (senha.length < 6) {
      setErro("A senha precisa ter ao menos 6 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setErro("As senhas não coincidem.");
      return;
    }

    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);

    if (error) {
      setErro("Não foi possível salvar a senha. Peça um novo link de convite.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-background px-4 py-10">
      <FadeIn className="flex w-full max-w-sm flex-col items-center gap-8">
        <Logo size="lg" stacked />

        <Card className="w-full">
          <CardContent className="pt-6">
            {carregando ? (
              <p className="text-center text-sm text-muted-foreground">Verificando convite...</p>
            ) : !sessaoValida ? (
              <p className="text-center text-sm text-status-reprovado">
                Link inválido ou expirado. Peça um novo convite.
              </p>
            ) : (
              <form onSubmit={salvar} className="flex flex-col gap-4">
                <p className="text-center text-sm text-muted-foreground">
                  Defina uma senha para acessar seus processos na SOMA.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="senha">Nova senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="senha"
                      type="password"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="border-transparent bg-muted pl-9"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirmacao">Confirme a senha</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmacao"
                      type="password"
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="border-transparent bg-muted pl-9"
                    />
                  </div>
                </div>

                {erro && <p className="text-sm text-status-reprovado">{erro}</p>}

                <Button type="submit" disabled={salvando} className="mt-2 w-full uppercase tracking-wide">
                  {salvando ? "Salvando..." : "Entrar"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
