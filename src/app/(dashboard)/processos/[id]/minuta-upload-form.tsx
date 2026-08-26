"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { enviarMinuta } from "./minuta-actions";

export function MinutaUploadForm({ cdProcesso }: { cdProcesso: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    const formData = new FormData(evento.currentTarget);

    startTransition(async () => {
      const resultado = await enviarMinuta(formData);

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
      className="flex flex-col gap-3 rounded-radius border border-dashed border-border p-4"
    >
      <input type="hidden" name="cd_processo" value={cdProcesso} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="arquivo_minuta">Arquivo da minuta</Label>
        <Input id="arquivo_minuta" name="arquivo" type="file" required />
      </div>
      <p className="text-xs text-muted-foreground">
        Envia pra aprovação das 5 frentes: Corretor, Comprador, Vendedor, Imobiliária e Jurídico.
      </p>
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Enviar minuta para aprovação"}
      </Button>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </form>
  );
}
