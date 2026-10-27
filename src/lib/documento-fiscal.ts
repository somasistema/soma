import { cnpjValido, cpfValido } from "@/lib/ocr/parsers";

// CPF (11 dígitos) ou CNPJ (14): o tipo é identificado pela quantidade de
// dígitos — quem digita não escolhe. Serve pro cadastro de vendedor/
// comprador, que pode ser pessoa física ou empresa.

export type TipoDocumentoFiscal = "cpf" | "cnpj" | null;

const soDigitos = (v: string) => v.replace(/\D/g, "");

// Até 11 dígitos a máscara é de CPF; passando disso vira CNPJ. Funciona
// enquanto a pessoa digita (a máscara muda no 12º dígito).
export function formatarCpfCnpj(valor: string): string {
  const d = soDigitos(valor).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
  }
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, "$1.$2.$3/$4-$5");
}

// Só decide quando o número está completo (11 ou 14 dígitos).
export function tipoDocumentoFiscal(valor: string): TipoDocumentoFiscal {
  const n = soDigitos(valor).length;
  if (n === 11) return "cpf";
  if (n === 14) return "cnpj";
  return null;
}

export function documentoFiscalValido(valor: string): boolean {
  const tipo = tipoDocumentoFiscal(valor);
  if (tipo === "cpf") return cpfValido(valor);
  if (tipo === "cnpj") return cnpjValido(valor);
  return false;
}

// Rótulo pra mostrar um documento já gravado: "CNPJ" ou "CPF".
export function rotuloDocumentoFiscal(valor: string | null | undefined): "CPF" | "CNPJ" {
  return tipoDocumentoFiscal(valor ?? "") === "cnpj" ? "CNPJ" : "CPF";
}
