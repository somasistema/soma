"use client";

import { cn } from "@/lib/utils";
import { CurrencyInput } from "./currency-input";

// Mesma máscara do CurrencyInput (2 casas, digita da direita pra
// esquerda: 2250 vira "22,50"), com o sufixo "%".
export function PercentInput({
  value,
  onChange,
  id,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <CurrencyInput
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="pr-7"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
        %
      </span>
    </div>
  );
}
