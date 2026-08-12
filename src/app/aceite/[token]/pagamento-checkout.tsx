"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FadeIn } from "@/components/motion/fade-in";
import { createClient } from "@/lib/supabase/client";
import { formatarMoeda } from "@/lib/utils";
import { criarPagamento, type PagamentoFormData } from "./pagamento-actions";

interface ResultadoPix {
  qrCode: string;
  qrCodeBase64: string;
}

export function PagamentoCheckout({ token, valor }: { token: string; valor: number }) {
  const router = useRouter();
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultadoPix, setResultadoPix] = useState<ResultadoPix | null>(null);
  const [aprovado, setAprovado] = useState(false);
  const [temConta, setTemConta] = useState(false);
  const [emailConta, setEmailConta] = useState("");
  const [codigoCopiado, setCodigoCopiado] = useState(false);

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (publicKey) {
      initMercadoPago(publicKey, { locale: "pt-BR" });
    }
  }, []);

  // Pix confirma de forma assíncrona (webhook do Mercado Pago, sem o
  // comprador voltar pra essa aba) — sem isso aqui a tela ficava parada
  // no QR Code pra sempre, mesmo com o pagamento já confirmado no banco.
  // Verifica a cada poucos segundos e recarrega assim que o status mudar.
  useEffect(() => {
    if (!resultadoPix) return;

    const supabase = createClient();
    let cancelado = false;

    async function verificar() {
      const { data } = await supabase
        .schema("soma")
        .rpc("fn_obter_orcamento_por_token", { p_token: token });

      if (!cancelado && data && data.tp_status !== "aceito") {
        router.refresh();
      }
    }

    const intervalo = setInterval(verificar, 4000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, [resultadoPix, token, router]);

  if (!process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
    return (
      <p className="text-sm text-status-reprovado">
        Pagamento indisponível: NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY não configurada.
      </p>
    );
  }

  if (aprovado) {
    return (
      <FadeIn>
        <p className="text-sm text-status-aceito">Pagamento aprovado! Obrigado.</p>
      </FadeIn>
    );
  }

  if (resultadoPix) {
    return (
      <FadeIn className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-foreground">Escaneie o QR Code ou use o Pix copia e cola:</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${resultadoPix.qrCodeBase64}`}
          alt="QR Code Pix"
          className="h-56 w-56"
        />
        <div className="flex w-full max-w-sm items-center gap-2">
          <p className="flex-1 truncate rounded-radius bg-muted px-3 py-2 text-left text-xs text-muted-foreground">
            {resultadoPix.qrCode}
          </p>
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(resultadoPix.qrCode);
              setCodigoCopiado(true);
              setTimeout(() => setCodigoCopiado(false), 2000);
            }}
          >
            {codigoCopiado ? "Copiado!" : "Copiar código"}
          </Button>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-status-pendente" />
          Verificando automaticamente assim que o pagamento for identificado...
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => router.refresh()}>
          Já paguei, verificar agora
        </Button>
      </FadeIn>
    );
  }

  return (
    <FadeIn>
      <Card>
        <CardHeader>
          <CardTitle>Pagamento — {formatarMoeda(valor)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 rounded-radius border border-border p-3">
            <p className="text-sm font-medium text-foreground">Você já tem uma conta na SOMA?</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={!temConta ? "default" : "outline"}
                onClick={() => setTemConta(false)}
              >
                Não, é minha primeira vez
              </Button>
              <Button
                type="button"
                size="sm"
                variant={temConta ? "default" : "outline"}
                onClick={() => setTemConta(true)}
              >
                Sim, já tenho conta
              </Button>
            </div>
            {temConta && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email_conta">E-mail da sua conta</Label>
                <Input
                  id="email_conta"
                  type="email"
                  value={emailConta}
                  onChange={(e) => setEmailConta(e.target.value)}
                  placeholder="voce@exemplo.com"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Vamos vincular este orçamento pago à sua conta existente, em vez de criar uma nova.
                </p>
              </div>
            )}
          </div>

          {!pronto && <p className="mb-2 text-sm text-muted-foreground">Carregando formulário de pagamento...</p>}
          <Payment
            initialization={{ amount: valor }}
            customization={{
              paymentMethods: {
                creditCard: "all",
                bankTransfer: "all", // Pix
                maxInstallments: 12,
              },
            }}
            onReady={() => setPronto(true)}
            onError={() => setErro("Não foi possível carregar o formulário de pagamento.")}
            onSubmit={async ({ formData }) => {
              setErro(null);

              if (temConta && !emailConta.trim()) {
                setErro("Informe o e-mail da sua conta existente, ou marque \"é minha primeira vez\".");
                throw new Error("email_conta_ausente");
              }

              const resultado = await criarPagamento(
                token,
                formData as PagamentoFormData,
                temConta ? emailConta.trim() : undefined
              );

              if (!resultado.sucesso) {
                setErro(resultado.erro);
                throw new Error(resultado.erro);
              }

              if (resultado.status === "approved") {
                setAprovado(true);
                router.refresh();
                return;
              }

              if (resultado.pixQrCode && resultado.pixQrCodeBase64) {
                setResultadoPix({ qrCode: resultado.pixQrCode, qrCodeBase64: resultado.pixQrCodeBase64 });
                return;
              }

              // Cartão pendente/em análise, boleto, etc.
              setErro(
                `Pagamento em análise (status: ${resultado.status}). Você será notificado quando for confirmado.`
              );
            }}
          />
          {erro && <p className="mt-2 text-sm text-status-reprovado">{erro}</p>}
        </CardContent>
      </Card>
    </FadeIn>
  );
}
