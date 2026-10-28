"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { decidirPeloLink } from "./actions";

export function DecisaoForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function decidir(aprovar: boolean) {
    setErro(null);
    startTransition(async () => {
      const r = await decidirPeloLink(token, aprovar, motivo);
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  if (recusando) {
    return (
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium text-foreground" htmlFor="motivo">
          Por que você está recusando ou o que quer alterar? (obrigatório)
        </label>
        <textarea
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex: o valor da entrada está diferente do combinado."
          className="flex min-h-28 w-full rounded-radius border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="destructive"
            disabled={pending || motivo.trim() === ""}
            onClick={() => decidir(false)}
          >
            {pending ? "Enviando..." : "Confirmar recusa"}
          </Button>
          <Button type="button" variant="outline" disabled={pending} onClick={() => setRecusando(false)}>
            Voltar
          </Button>
        </div>
        {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Depois de ler a minuta, escolha uma opção. Ao aceitar, você concorda com o texto
        apresentado nesta versão.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={pending} onClick={() => decidir(true)}>
          {pending ? "Enviando..." : "Aceitar a minuta"}
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={() => setRecusando(true)}>
          Recusar / pedir alteração
        </Button>
      </div>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
