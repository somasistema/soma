import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EyeOff, FileText, Lock, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Logo } from "@/components/logo";
import { createPublicClient } from "@/lib/supabase/public";
import { LADO_PARTE_LABEL, type ParteAutoatendimento } from "@/types/database";
import { ParteAutoatendimentoForm } from "./parte-autoatendimento-form";

// anexarMeuDocumento roda o OCR na mesma requisição do server action.
export const maxDuration = 60;

// Página pessoal: não aparece em buscas (Google etc.).
export const metadata: Metadata = {
  title: "Seus dados e documentos — SOMA",
  robots: { index: false, follow: false },
};

const SEGURANCA: { icone: typeof Lock; titulo: string; texto: string }[] = [
  {
    icone: UserCheck,
    titulo: "Este link é só seu",
    texto:
      "Ele foi criado especialmente para você. Só quem tem este endereço consegue abrir, e ele não aparece em buscas na internet.",
  },
  {
    icone: Lock,
    titulo: "Conexão protegida",
    texto:
      "Tudo o que você envia viaja criptografado (repare no cadeado ao lado do endereço, no topo do navegador).",
  },
  {
    icone: EyeOff,
    titulo: "Seus arquivos não ficam públicos",
    texto:
      "Os documentos ficam guardados em área privada, e só pessoas autorizadas, envolvidas no seu processo, conseguem abri-los.",
  },
  {
    icone: FileText,
    titulo: "Usamos só para o seu contrato",
    texto:
      "Seus dados servem para elaborar o contrato e os procedimentos do seu imóvel. Só são repassados quando indispensável para isso (por exemplo: cartório, banco e assinatura digital) — nunca para venda ou publicidade.",
  },
  {
    icone: Sparkles,
    titulo: "Leitura automática dos documentos",
    texto:
      "Para poupar sua digitação, um sistema automático, com apoio de inteligência artificial, lê o documento e preenche seu cadastro. Você sempre confere e corrige o que quiser.",
  },
];

export default async function PartePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Página pública, sem sessão — client anon + RPC SECURITY DEFINER
  // que resolve a parte pelo próprio token.
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .schema("soma")
    .rpc("fn_parte_por_token", { p_token: token });

  // Falha de consulta (rede/banco) não é "link inexistente": deixa o erro aparecer
  // em vez de mostrar 404 e esconder a causa.
  if (error) {
    throw new Error(`Não foi possível consultar o link: ${error.message}`);
  }

  const parte = data as ParteAutoatendimento | null;
  if (!parte) {
    notFound();
  }

  const papel = LADO_PARTE_LABEL[parte.tp_lado] ?? parte.tp_lado;
  const nomeProvisorio = (parte.nm_parte ?? "").includes("aguardando preenchimento");
  const primeiroNome = nomeProvisorio ? null : parte.nm_parte?.trim().split(/\s+/)[0];
  // Link gerado antes de o processo ser criado ainda não tem número.
  const refProcesso = parte.ds_numero_processo
    ? `do processo ${parte.ds_numero_processo}`
    : "do seu contrato";

  return (
    <div className="flex min-h-screen justify-center bg-muted px-4 py-10">
      <FadeIn className="flex w-full max-w-xl flex-col gap-6">
        <div>
          <Logo size="sm" className="mb-3 items-start" />
          <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
            {primeiroNome ? `Olá, ${primeiroNome}!` : "Olá!"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Você foi convidado(a) pela equipe da <strong className="text-foreground">SOMA</strong>{" "}
            para enviar seus dados e documentos {refProcesso}, como{" "}
            <strong className="text-foreground">{papel}</strong>. É rápido: leva uns minutos.
          </p>
        </div>

        <section
          aria-labelledby="seguranca"
          className="rounded-radius border border-status-aceito/40 bg-card p-4"
        >
          <h2
            id="seguranca"
            className="mb-1 flex items-center gap-2 text-base font-semibold text-foreground"
          >
            <ShieldCheck className="h-5 w-5 text-status-aceito" />
            Esta não é uma página qualquer — seus dados estão protegidos
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">
            Sabemos que documentos pessoais são assunto sério. Por isso, explicamos como cuidamos
            deles:
          </p>
          <ul className="flex flex-col gap-3">
            {SEGURANCA.map(({ icone: Icone, titulo, texto }) => (
              <li key={titulo} className="flex gap-3">
                <Icone className="mt-0.5 h-4 w-4 shrink-0 text-status-aceito" />
                <p className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{titulo}.</strong> {texto}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-radius bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Fique tranquilo(a):</strong> esta página nunca pede
            senha, dados de cartão nem pagamento. Se algum dia alguém pedir isso em nome da SOMA, não
            é a gente. Dúvidas, ou quer corrigir ou apagar seus dados? Fale com a equipe da SOMA que
            enviou este link — seus direitos como titular (LGPD) são respeitados.
          </p>
        </section>

        <section aria-labelledby="passos" className="rounded-radius border border-border bg-card p-4">
          <h2 id="passos" className="mb-3 text-base font-semibold text-foreground">
            Como funciona
          </h2>
          <ol className="flex flex-col gap-2.5 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-foreground">
                1
              </span>
              <span>
                <strong className="text-foreground">Anexe seus documentos</strong> (foto ou PDF) nos
                itens abaixo. Ao enviar, lemos o documento e já preenchemos seus dados.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-foreground">
                2
              </span>
              <span>
                <strong className="text-foreground">Confira e complete</strong> o que faltar em “Meus
                dados” e clique em <em>Salvar</em>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-foreground">
                3
              </span>
              <span>
                <strong className="text-foreground">Pronto!</strong> A equipe da SOMA recebe tudo e
                segue com o seu contrato. Pode fechar a página — se precisar, o mesmo link continua
                valendo para enviar algo que tenha esquecido.
              </span>
            </li>
          </ol>
        </section>

        <ParteAutoatendimentoForm token={token} parte={parte} />

        <p className="pb-4 text-center text-xs text-muted-foreground">
          SOMA — contratos e regularização de imóveis · Seus dados são usados exclusivamente para o
          {parte.ds_numero_processo ? `processo ${parte.ds_numero_processo}` : "seu contrato"}.
        </p>
      </FadeIn>
    </div>
  );
}
