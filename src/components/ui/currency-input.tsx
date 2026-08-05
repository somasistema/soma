"use client";

import { useEffect, useRef } from "react";
import { Input } from "./input";

// Máscara de dinheiro estilo caixa eletrônico: o usuário só digita
// números (da direita pra esquerda, em centavos) e o campo já mostra
// formatado — 300000 vira "3.000,00", 30000000 vira "300.000,00".
// value/onChange continuam sendo a string numérica crua (compatível
// com Number(valor)) pra não precisar mudar quem já usa esses campos.
function formatarCentavos(digitos: string) {
  const centavos = parseInt(digitos || "0", 10);
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function CurrencyInput({
  value,
  onChange,
  id,
  name,
  className,
  disabled,
  placeholder = "0,00",
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const digitosAtuais = value ? String(Math.round(Number(value) * 100)) : "";
  const display = value === "" ? "" : formatarCentavos(digitosAtuais);

  // Sempre com o cursor no fim — é assim que máscara de centavos
  // funciona (digitar no meio não faz sentido conceitualmente, já que
  // cada dígito novo empurra os outros pra esquerda).
  useEffect(() => {
    const el = inputRef.current;
    if (el) el.setSelectionRange(el.value.length, el.value.length);
  });

  function aoDigitar(e: React.ChangeEvent<HTMLInputElement>) {
    const digitos = e.target.value.replace(/\D/g, "");
    if (!digitos) {
      onChange("");
      return;
    }
    onChange(String(parseInt(digitos, 10) / 100));
  }

  return (
    <>
      <Input
        ref={inputRef}
        id={id}
        inputMode="numeric"
        value={display}
        onChange={aoDigitar}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
      />
      {/* Formulários com action nativa (FormData) leem por "name" — o
          input visível não tem name porque o texto formatado ("300.000,00")
          não é um número válido pro servidor fazer Number(valor). */}
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
