"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CAMPOS_MODELO_CONTRATO, type ModeloContrato } from "@/types/database";
import { salvarModelo } from "./actions";

const TEXTAREA_CLASS =
  "flex min-h-[220px] w-full rounded-radius border border-border bg-card px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50";

export function ModeloEditor({
  modelo,
  onPronto,
}: {
  modelo?: ModeloContrato;
  onPronto?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [nm, setNm] = useState(modelo?.nm_modelo ?? "");
  const [descricao, setDescricao] = useState(modelo?.ds_descricao ?? "");
  const [conteudo, setConteudo] = useState(modelo?.ds_conteudo ?? "");

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const resultado = await salvarModelo({
        cd_modelo: modelo?.cd_modelo ?? null,
        nm_modelo: nm,
        ds_descricao: descricao,
        ds_conteudo: conteudo,
      });
      if (resultado?.erro) {
        setErro(resultado.erro);
        return;
      }
      if (!modelo) {
        setNm("");
        setDescricao("");
        setConteudo("");
      }
      router.refresh();
      onPronto?.();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`nm-${modelo?.cd_modelo ?? "novo"}`}>Nome do modelo</Label>
        <Input
          id={`nm-${modelo?.cd_modelo ?? "novo"}`}
          value={nm}
          onChange={(e) => setNm(e.target.value)}
          placeholder="Ex: Compra e venda — financiamento bancário"
          maxLength={120}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`ds-${modelo?.cd_modelo ?? "novo"}`}>Descrição (opcional)</Label>
        <Input
          id={`ds-${modelo?.cd_modelo ?? "novo"}`}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Quando usar este modelo"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`ct-${modelo?.cd_modelo ?? "novo"}`}>Texto do contrato</Label>
        <textarea
          id={`ct-${modelo?.cd_modelo ?? "novo"}`}
          className={TEXTAREA_CLASS}
          value={conteudo}
          onChange={(e) => setConteudo(e.target.value)}
          placeholder="Cole aqui o texto-base do contrato, usando os campos abaixo onde os dados do processo devem entrar."
        />
        <div className="rounded-radius border border-dashed border-border p-3">
          <p className="mb-1.5 text-xs font-medium text-foreground">
            Campos preenchidos ao gerar a minuta:
          </p>
          <ul className="flex flex-col gap-0.5">
            {CAMPOS_MODELO_CONTRATO.map((campo) => (
              <li key={campo.token} className="text-xs text-muted-foreground">
                <code className="text-foreground">{campo.token}</code> — {campo.descricao}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={salvar}>
          {pending ? "Salvando..." : modelo ? "Salvar alterações" : "Criar modelo"}
        </Button>
        {onPronto && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onPronto}>
            Cancelar
          </Button>
        )}
      </div>
      {modelo && (
        <p className="text-xs text-muted-foreground">
          Versão atual: {modelo.nr_versao}. Alterar o texto sobe uma versão nova; renomear, não.
        </p>
      )}
    </div>
  );
}
