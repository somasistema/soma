"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { gerarMinutaDeModelo } from "./minuta-actions";

type ModeloOpcao = { cd_modelo: string; nm_modelo: string };

export function MinutaDeModeloForm({
  cdProcesso,
  modelos,
}: {
  cdProcesso: string;
  modelos: ModeloOpcao[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [cdModelo, setCdModelo] = useState("");

  if (modelos.length === 0) return null;

  function gerar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await gerarMinutaDeModelo(cdProcesso, cdModelo);
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-radius border border-dashed border-border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="modelo_minuta">Gerar minuta a partir de um modelo</Label>
        <Select
          id="modelo_minuta"
          value={cdModelo}
          onChange={(e) => setCdModelo(e.target.value)}
        >
          <option value="">Selecione um modelo...</option>
          {modelos.map((modelo) => (
            <option key={modelo.cd_modelo} value={modelo.cd_modelo}>
              {modelo.nm_modelo}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Os campos do modelo ({"{{comprador}}"}, {"{{vendedor}}"}...) são preenchidos com os dados
        deste processo e a minuta vai direto pra aprovação das 5 frentes.
      </p>
      <Button
        type="button"
        size="sm"
        disabled={pending || !cdModelo}
        onClick={gerar}
        className="self-start"
      >
        {pending ? "Gerando..." : "Gerar minuta"}
      </Button>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
