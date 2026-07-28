"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarAndamento } from "./actions";

export function AndamentoForm({ cdProcesso }: { cdProcesso: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    const formData = new FormData(evento.currentTarget);
    const nmEtapa = String(formData.get("nm_etapa") ?? "");
    const dsAndamento = String(formData.get("ds_andamento") ?? "");

    startTransition(async () => {
      const resultado = await criarAndamento(cdProcesso, nmEtapa, dsAndamento);

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={enviar} className="flex flex-col gap-3 rounded-radius border border-border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="nm_etapa">Etapa</Label>
        <Input id="nm_etapa" name="nm_etapa" placeholder="Ex: Protocolo no cartório" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="ds_andamento">Descrição</Label>
        <Input id="ds_andamento" name="ds_andamento" placeholder="Detalhes do andamento" required />
      </div>
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Registrando..." : "Registrar andamento"}
      </Button>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </form>
  );
}
