"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarPendencia } from "./actions";

export function PendenciaForm({ cdProcesso }: { cdProcesso: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    const formData = new FormData(evento.currentTarget);
    const dsPendencia = String(formData.get("ds_pendencia") ?? "");
    const dtPrazo = String(formData.get("dt_prazo") ?? "");

    startTransition(async () => {
      const resultado = await criarPendencia(cdProcesso, dsPendencia, dtPrazo || null);

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={enviar}
      className="flex flex-col gap-3 rounded-radius border border-border p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="ds_pendencia">Pendência</Label>
        <Input id="ds_pendencia" name="ds_pendencia" placeholder="Ex: Enviar certidão negativa" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dt_prazo">Prazo</Label>
        <Input id="dt_prazo" name="dt_prazo" type="date" />
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adicionando..." : "Adicionar"}
      </Button>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </form>
  );
}
