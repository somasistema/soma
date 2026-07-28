"use server";

import { Payment } from "mercadopago";
import { getMercadoPagoClient, getSiteUrl } from "@/lib/mercadopago";
import { VALOR_FIXO_DEMONSTRACAO } from "@/lib/pagamento-config";
import { createPublicClient } from "@/lib/supabase/public";
import type { OrcamentoAceite } from "@/types/database";

export interface PagamentoPayerInput {
  email: string;
  first_name?: string;
  last_name?: string;
  identification?: { type: string; number: string };
}

export interface PagamentoFormData {
  payment_method_id: string;
  token?: string; // presente em pagamento com cartão (gerado no client pelo Brick)
  installments?: number;
  issuer_id?: string;
  payer: PagamentoPayerInput;
}

export type CriarPagamentoState =
  | {
      sucesso: true;
      status: string;
      statusDetail: string | null;
      pixQrCode: string | null;
      pixQrCodeBase64: string | null;
      ticketUrl: string | null;
    }
  | { sucesso: false; erro: string };

// Página pública (/aceite/[token]) — mesma autorização por token do
// resto do fluxo de aceite. O pagamento em si não é gravado aqui: só
// pedimos pro Mercado Pago processar e devolvemos o resultado
// imediato pro comprador (ex: QR Code do Pix). O registro definitivo
// em soma.pagamentos acontece de forma assíncrona, via
// /api/webhooks/mercadopago com service_role — soma.pagamentos_insert
// bloqueia INSERT direto do client de propósito (ver migration 002).
export async function criarPagamento(
  token: string,
  formData: PagamentoFormData
): Promise<CriarPagamentoState> {
  const supabasePublic = createPublicClient();

  const { data } = await supabasePublic
    .schema("soma")
    .rpc("fn_obter_orcamento_por_token", { p_token: token });

  const orcamento = data as OrcamentoAceite | null;

  if (!orcamento) {
    return { sucesso: false, erro: "Orçamento não encontrado." };
  }

  if (orcamento.tp_status !== "aceito") {
    return { sucesso: false, erro: "Este orçamento não está disponível para pagamento." };
  }

  const valor = VALOR_FIXO_DEMONSTRACAO;
  const siteUrl = getSiteUrl();

  try {
    const payment = new Payment(getMercadoPagoClient());
    const resultado = await payment.create({
      body: {
        transaction_amount: valor,
        token: formData.token,
        installments: formData.installments,
        payment_method_id: formData.payment_method_id,
        issuer_id: formData.issuer_id ? Number(formData.issuer_id) : undefined,
        payer: formData.payer,
        description: `Orçamento ${orcamento.processo.ds_numero_processo} — SOMA Assessoria Imobiliária`,
        external_reference: orcamento.cd_orcamento,
        notification_url: siteUrl ? `${siteUrl}/api/webhooks/mercadopago` : undefined,
      },
      requestOptions: { idempotencyKey: `${orcamento.cd_orcamento}-${Date.now()}` },
    });

    return {
      sucesso: true,
      status: resultado.status ?? "pending",
      statusDetail: resultado.status_detail ?? null,
      pixQrCode: resultado.point_of_interaction?.transaction_data?.qr_code ?? null,
      pixQrCodeBase64: resultado.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
      ticketUrl: resultado.point_of_interaction?.transaction_data?.ticket_url ?? null,
    };
  } catch (erro) {
    console.error("Erro ao criar pagamento no Mercado Pago:", erro);
    return { sucesso: false, erro: "Não foi possível processar o pagamento. Tente novamente." };
  }
}
