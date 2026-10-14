"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarTelefone } from "@/lib/utils";
import type { Imobiliaria } from "@/types/database";
import { salvarImobiliaria, type ImobiliariaDados } from "./actions";

function dadosIniciais(imob?: Imobiliaria): ImobiliariaDados {
  return {
    cd_imobiliaria: imob?.cd_imobiliaria ?? null,
    nm_imobiliaria: imob?.nm_imobiliaria ?? "",
    ds_cnpj: imob?.ds_cnpj ?? "",
    ds_creci: imob?.ds_creci ?? "",
    ds_endereco: imob?.ds_endereco ?? "",
    ds_telefone: imob?.ds_telefone ?? "",
    ds_email: imob?.ds_email ?? "",
  };
}

export function ImobiliariaForm({
  imobiliaria,
  onPronto,
}: {
  imobiliaria?: Imobiliaria;
  onPronto?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<ImobiliariaDados>(() => dadosIniciais(imobiliaria));
  const sufixo = imobiliaria?.cd_imobiliaria ?? "nova";

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await salvarImobiliaria(dados);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      if (!imobiliaria) setDados(dadosIniciais());
      onPronto?.();
    });
  }

  const campo = (
    id: Exclude<keyof ImobiliariaDados, "cd_imobiliaria">,
    label: string,
    extra?: { tipo?: string; placeholder?: string; telefone?: boolean; largo?: boolean }
  ) => (
    <div className={`flex flex-col gap-1.5 ${extra?.largo ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={`${id}-${sufixo}`}>{label}</Label>
      <Input
        id={`${id}-${sufixo}`}
        type={extra?.tipo}
        placeholder={extra?.placeholder}
        value={dados[id]}
        onChange={(e) =>
          setDados((d) => ({
            ...d,
            [id]: extra?.telefone ? formatarTelefone(e.target.value) : e.target.value,
          }))
        }
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {campo("nm_imobiliaria", "Razão social", { largo: true })}
        {campo("ds_cnpj", "CNPJ")}
        {campo("ds_creci", "CRECI-PJ (só o número)", { placeholder: "Ex: 1.617" })}
        {campo("ds_endereco", "Endereço da sede", {
          largo: true,
          placeholder: "Rua, número, sala, bairro, cidade/UF, CEP",
        })}
        {campo("ds_telefone", "Telefone", { tipo: "tel", placeholder: "(71) 99999-9999", telefone: true })}
        {campo("ds_email", "E-mail", { tipo: "email" })}
      </div>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={salvar}>
          {pending ? "Salvando..." : imobiliaria ? "Salvar alterações" : "Cadastrar imobiliária"}
        </Button>
        {onPronto && imobiliaria && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onPronto}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
