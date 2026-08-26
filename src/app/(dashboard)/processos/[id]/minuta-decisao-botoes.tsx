"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { TipoPapelAprovacao } from "@/types/database";
import { decidirMinuta } from "./minuta-actions";

export function MinutaDecisaoBotoes({
  cdMinuta,
  tpPapel,
}: {
  cdMinuta: string;
  tpPapel: TipoPapelAprovacao;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [reprovando, setReprovando] = useState(false);
  const [comentario, setComentario] = useState("");

  function decidir(aprovar: boolean, comentarioFinal: string | null) {
    setErro(null);
    startTransition(async () => {
      const resultado = await decidirMinuta(cdMinuta, tpPapel, aprovar, comentarioFinal);
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  if (reprovando) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Motivo da reprovação (obrigatório)"
          className="flex min-h-20 w-full rounded-radius border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={pending || comentario.trim() === ""}
            onClick={() => decidir(false, comentario.trim())}
          >
            {pending ? "Enviando..." : "Confirmar reprovação"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setReprovando(false)}>
            Cancelar
          </Button>
        </div>
        {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={() => decidir(true, null)}>
          {pending ? "Enviando..." : "Aprovar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setReprovando(true)}
        >
          Reprovar
        </Button>
      </div>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
