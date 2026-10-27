"use client";

import {
  documentoFiscalValido,
  formatarCpfCnpj,
  tipoDocumentoFiscal,
} from "@/lib/documento-fiscal";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { Label } from "./label";

// Campo "CPF ou CNPJ": a máscara e o tipo saem sozinhos pelo número de
// dígitos, e avisa na hora se o número não for válido. O aviso não bloqueia
// o cadastro (o documento pode estar sendo digitado ou ter erro de origem).
export function DocumentoFiscalInput({
  id,
  label = "CPF ou CNPJ",
  value,
  onChange,
  placeholder,
  className,
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const tipo = tipoDocumentoFiscal(value);
  const completo = tipo !== null;
  const valido = completo && documentoFiscalValido(value);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="numeric"
        value={value}
        placeholder={placeholder ?? "000.000.000-00 ou 00.000.000/0000-00"}
        onChange={(e) => onChange(formatarCpfCnpj(e.target.value))}
      />
      {completo && (
        <span className={cn("text-xs", valido ? "text-status-aceito" : "text-status-reprovado")}>
          {valido
            ? tipo === "cnpj"
              ? "CNPJ — pessoa jurídica (empresa)"
              : "CPF — pessoa física"
            : tipo === "cnpj"
              ? "CNPJ inválido — confira os números"
              : "CPF inválido — confira os números"}
        </span>
      )}
    </div>
  );
}
