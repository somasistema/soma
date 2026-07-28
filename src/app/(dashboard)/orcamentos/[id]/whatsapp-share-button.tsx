"use client";

import { buttonVariants } from "@/components/ui/button-variants";

function apenasDigitos(valor: string) {
  return valor.replace(/\D/g, "");
}

export function WhatsappShareButton({
  telefone,
  nomeComprador,
  numeroProcesso,
  link,
}: {
  telefone: string;
  nomeComprador: string | null;
  numeroProcesso: string;
  link: string;
}) {
  const digitos = apenasDigitos(telefone);
  // Números salvos sem DDI (ex: "71991385076") recebem o 55 do Brasil;
  // se já vier com DDI (13 dígitos, começando com 55) usamos como está.
  const numeroComDdi = digitos.length > 11 ? digitos : `55${digitos}`;

  const mensagem = `Olá${nomeComprador ? `, ${nomeComprador}` : ""}! Segue o orçamento do processo ${numeroProcesso} da SOMA Assessoria Imobiliária para sua análise e aceite: ${link}`;

  const url = `https://wa.me/${numeroComDdi}?text=${encodeURIComponent(mensagem)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({ variant: "accent", size: "sm" })}
    >
      Enviar via WhatsApp
    </a>
  );
}
