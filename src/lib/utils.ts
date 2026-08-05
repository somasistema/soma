import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Fuso fixo da operação (Bahia = America/Sao_Paulo, sem horário de
// verão hoje) — sem isso, formatação de data/hora no servidor (Vercel
// roda em UTC) mostra hora errada e pode até virar o dia (uma
// TIMESTAMPTZ perto da meia-noite UTC cai no dia anterior em Bahia).
const FUSO_OPERACAO = "America/Bahia";

export function formatarData(data: string | Date) {
  // Coluna DATE pura (ex: dt_validade, "2026-01-05", sem hora) —
  // formata direto da string, sem passar por Date/fuso horário, pra
  // nunca arriscar cair no dia anterior/seguinte.
  if (typeof data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data)) {
    const [ano, mes, dia] = data.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return new Date(data).toLocaleDateString("pt-BR", { timeZone: FUSO_OPERACAO });
}

export function formatarDataHora(data: string | Date) {
  return new Date(data).toLocaleString("pt-BR", { timeZone: FUSO_OPERACAO });
}

// Máscara progressiva de telefone BR enquanto o usuário digita —
// (XX) XXXXX-XXXX pra celular (11 dígitos), (XX) XXXX-XXXX pra fixo.
export function formatarTelefone(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);

  if (digitos.length <= 2) return digitos.replace(/^(\d*)/, "($1");
  if (digitos.length <= 6) return digitos.replace(/^(\d{2})(\d*)/, "($1) $2");
  if (digitos.length <= 10) return digitos.replace(/^(\d{2})(\d{4})(\d*)/, "($1) $2-$3");
  return digitos.replace(/^(\d{2})(\d{5})(\d*)/, "($1) $2-$3");
}