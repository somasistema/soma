import { criarProvedorClicksign } from "./clicksign";
import type { ProvedorAssinatura } from "./tipos";

export type { ProvedorAssinatura } from "./tipos";

// Provedor de assinatura ativo (Clicksign), ou null enquanto não houver
// token configurado. Toda a esteira de contrato funciona sem ele — o
// contrato só fica parado em 'aguardando_assinatura'.
export function getProvedorAssinatura(): ProvedorAssinatura | null {
  if (!process.env.CLICKSIGN_API_TOKEN) return null;
  return criarProvedorClicksign();
}

export function assinaturaConfigurada(): boolean {
  return Boolean(process.env.CLICKSIGN_API_TOKEN);
}
