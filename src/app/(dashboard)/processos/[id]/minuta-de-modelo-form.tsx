"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { gerarMinutaDeModelo, previsualizarMinutaDeModelo } from "./minuta-actions";

type ModeloOpcao = { cd_modelo: string; nm_modelo: string };

export function MinutaDeModeloForm({
  cdProcesso,
  modelos,
}: {
  cdProcesso: string;
  modelos: ModeloOpcao[];
}) {
  const router = useRouter();
  const [gerando, startGerar] = useTransition();
  const [previsualizando, startPrevisualizar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [cdModelo, setCdModelo] = useState("");
  const [previa, setPrevia] = useState<string | null>(null);

  if (modelos.length === 0) return null;

  function trocarModelo(valor: string) {
    setCdModelo(valor);
    setPrevia(null);
    setErro(null);
  }

  function previsualizar() {
    setErro(null);
    startPrevisualizar(async () => {
      const resultado = await previsualizarMinutaDeModelo(cdProcesso, cdModelo);
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setPrevia(resultado.texto);
    });
  }

  function gerar() {
    setErro(null);
    startGerar(async () => {
      const resultado = await gerarMinutaDeModelo(cdProcesso, cdModelo);
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      router.refresh();
    });
  }

  const ocupado = gerando || previsualizando;

  return (
    <div className="flex flex-col gap-3 rounded-radius border border-dashed border-border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="modelo_minuta">Gerar minuta a partir de um modelo</Label>
        <Select
          id="modelo_minuta"
          value={cdModelo}
          onChange={(e) => trocarModelo(e.target.value)}
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

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={ocupado || !cdModelo}
          onClick={previsualizar}
        >
          {previsualizando ? "Gerando prévia..." : "Pré-visualizar"}
        </Button>
        <Button type="button" size="sm" disabled={ocupado || !cdModelo} onClick={gerar}>
          {gerando ? "Gerando..." : "Gerar minuta"}
        </Button>
      </div>

      {previa !== null && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">
              Prévia — assim a minuta será criada (ainda editável pelo Jurídico)
            </span>
            <button
              type="button"
              onClick={() => setPrevia(null)}
              className="text-xs text-muted-foreground underline"
            >
              fechar
            </button>
          </div>
          <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-radius border border-border bg-card p-3 font-mono text-xs text-foreground">
            {previa || "(modelo vazio)"}
          </pre>
        </div>
      )}

      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}
