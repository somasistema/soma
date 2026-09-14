import { notFound } from "next/navigation";
import { FadeIn } from "@/components/motion/fade-in";
import { Logo } from "@/components/logo";
import { createPublicClient } from "@/lib/supabase/public";
import type { ParteAutoatendimento } from "@/types/database";
import { ParteAutoatendimentoForm } from "./parte-autoatendimento-form";

// anexarMeuDocumento roda o OCR na mesma requisição do server action.
export const maxDuration = 60;

export default async function PartePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Página pública, sem sessão — client anon + RPC SECURITY DEFINER
  // que resolve a parte pelo próprio token.
  const supabase = createPublicClient();
  const { data } = await supabase
    .schema("soma")
    .rpc("fn_parte_por_token", { p_token: token });

  const parte = data as ParteAutoatendimento | null;
  if (!parte) {
    notFound();
  }

  const papel = parte.tp_lado === "vendedor" ? "Vendedor" : "Comprador";

  return (
    <div className="flex min-h-screen justify-center bg-muted px-4 py-12">
      <FadeIn className="flex w-full max-w-xl flex-col gap-6">
        <div>
          <Logo size="sm" className="mb-2 items-start" />
          <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
            Processo {parte.ds_numero_processo}
          </h1>
          <p className="text-sm text-muted-foreground">
            Você está cadastrado(a) como <strong className="text-foreground">{papel}</strong>.
            Preencha seus dados e anexe seus documentos abaixo.
          </p>
        </div>

        <ParteAutoatendimentoForm token={token} parte={parte} />
      </FadeIn>
    </div>
  );
}
