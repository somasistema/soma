import { criarProvedorAutentique } from "./autentique";
import type { ProvedorAssinatura } from "./tipos";

export type { ProvedorAssinatura } from "./tipos";

// Provedor de assinatura ativo, ou null enquanto não houver token
// configurado. Toda a esteira de contrato funciona sem ele — o
// contrato só fica parado em 'aguardando_assinatura'.
export function getProvedorAssinatura(): ProvedorAssinatura | null {
  if (!process.env.AUTENTIQUE_API_TOKEN) return null;
  return criarProvedorAutentique();
}

export function assinaturaConfigurada(): boolean {
  return Boolean(process.env.AUTENTIQUE_API_TOKEN);
}
