"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

// Janela de confirmação no visual do sistema (no lugar do window.confirm do navegador).
// Fecha com Esc ou clicando fora; o foco começa no botão de confirmar.
export function ConfirmarDialogo({
  aberto,
  titulo,
  children,
  confirmar = "Continuar",
  cancelar = "Cancelar",
  onConfirmar,
  onCancelar,
}: {
  aberto: boolean;
  titulo: string;
  children: React.ReactNode;
  confirmar?: string;
  cancelar?: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const botaoConfirmar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!aberto) return;
    botaoConfirmar.current?.focus();
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onCancelar();
    }
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, onCancelar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancelar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-sm rounded-radius border border-border bg-card p-5 shadow-xl"
      >
        <h2 className="text-base font-semibold text-foreground">{titulo}</h2>
        <div className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancelar}>
            {cancelar}
          </Button>
          <Button ref={botaoConfirmar} type="button" size="sm" onClick={onConfirmar}>
            {confirmar}
          </Button>
        </div>
      </div>
    </div>
  );
}
