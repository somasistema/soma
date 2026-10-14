"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarTelefone } from "@/lib/utils";
import type { Corretor } from "@/types/database";
import { salvarCorretor, type CorretorDados } from "./actions";

function dadosIniciais(corretor?: Corretor): CorretorDados {
  return {
    cd_corretor: corretor?.cd_corretor ?? null,
    nm_corretor: corretor?.nm_corretor ?? "",
    ds_cpf: corretor?.ds_cpf ?? "",
    ds_creci: corretor?.ds_creci ?? "",
    ds_telefone: corretor?.ds_telefone ?? "",
    ds_email: corretor?.ds_email ?? "",
    ds_pix: corretor?.ds_pix ?? "",
    ds_conta_bancaria: corretor?.ds_conta_bancaria ?? "",
    dt_nascimento: corretor?.dt_nascimento?.slice(0, 10) ?? "",
  };
}

export function CorretorForm({
  corretor,
  onPronto,
}: {
  corretor?: Corretor;
  onPronto?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<CorretorDados>(() => dadosIniciais(corretor));
  const sufixo = corretor?.cd_corretor ?? "novo";

  function patch(p: Partial<CorretorDados>) {
    setDados((d) => ({ ...d, ...p }));
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await salvarCorretor(dados);
      if (r.erro) {
        setErro(r.erro);
        return;
      }
      if (!corretor) setDados(dadosIniciais());
      onPronto?.();
    });
  }

  const campo = (
    id: keyof CorretorDados,
    label: string,
    extra?: { tipo?: string; placeholder?: string; telefone?: boolean; className?: string }
  ) => (
    <div className={`flex flex-col gap-1.5 ${extra?.className ?? ""}`}>
      <Label htmlFor={`${id}-${sufixo}`}>{label}</Label>
      <Input
        id={`${id}-${sufixo}`}
        type={extra?.tipo}
        placeholder={extra?.placeholder}
        value={(dados[id] as string) ?? ""}
        onChange={(e) =>
          patch({ [id]: extra?.telefone ? formatarTelefone(e.target.value) : e.target.value })
        }
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {campo("nm_corretor", "Nome", { className: "sm:col-span-2" })}
        {campo("ds_cpf", "CPF")}
        {campo("dt_nascimento", "Data de nascimento", { tipo: "date" })}
        {campo("ds_creci", "CRECI (só o número)", { placeholder: "Ex: 12345" })}
        {campo("ds_telefone", "Telefone", { tipo: "tel", placeholder: "(71) 99999-9999", telefone: true })}
        {campo("ds_email", "E-mail", { tipo: "email" })}
        {campo("ds_pix", "Chave PIX")}
        {campo("ds_conta_bancaria", "Conta bancária", { placeholder: "Banco, agência e conta" })}
      </div>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" disabled={pending} onClick={salvar}>
          {pending ? "Salvando..." : corretor ? "Salvar alterações" : "Cadastrar corretor"}
        </Button>
        {onPronto && corretor && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={onPronto}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
