"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { initMercadoPago, Payment } from "@mercadopago/sdk-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
    if (publicKey) {
      initMercadoPago(publicKey, { locale: "pt-BR" });
    }
  }, []);

  if (!process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
    return (
      <p className="text-sm text-status-reprovado">
        Pagamento indisponível: NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY não configurada.
      </p>
    );
  }

  if (aprovado) {
    return <p className="text-sm text-status-aceito">Pagamento aprovado! Obrigado.</p>;
  }

  if (resultadoPix) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-foreground">
          Escaneie o QR Code no app do seu banco para pagar via Pix:
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${resultadoPix.qrCodeBase64}`}
          alt="QR Code Pix"
          className="h-56 w-56"
        />
        <p className="max-w-full break-all rounded-radius bg-muted px-3 py-2 text-xs text-muted-foreground">
          {resultadoPix.qrCode}
        </p>
        <p className="text-xs text-muted-foreground">
          A confirmação é automática assim que o pagamento for identificado.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pagamento — {formatarMoeda(valor)}</CardTitle>
      </CardHeader>
      <CardContent>
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

            const resultado = await criarPagamento(token, formData as PagamentoFormData);

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
  );
}
