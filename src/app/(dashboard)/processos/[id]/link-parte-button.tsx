"use client";

import { Copy, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

// Link público de autoatendimento da parte — copiar ou mandar no WhatsApp.
export function LinkParteButton({
  link,
  telefone,
  nome,
  numeroProcesso,
}: {
  link: string;
  telefone: string | null;
  nome: string;
  numeroProcesso: string;
}) {
  const [copiado, setCopiado] = useState(false);

  function copiar() {
    navigator.clipboard.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    });
  }

  const digitos = (telefone ?? "").replace(/\D/g, "");
  const numeroWa = digitos ? (digitos.length > 11 ? digitos : `55${digitos}`) : null;
  const mensagem = `Olá${nome ? `, ${nome}` : ""}! Para o processo ${numeroProcesso} da SOMA, preencha seus dados e anexe seus documentos neste link: ${link}`;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        onClick={copiar}
      >
        <Copy className="h-3 w-3" />
        {copiado ? "copiado" : "copiar link"}
      </Button>
      {numeroWa && (
        <a
          href={`https://wa.me/${numeroWa}?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-radius border border-border px-2 text-xs text-foreground hover:bg-muted"
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </a>
      )}
    </div>
  );
}
