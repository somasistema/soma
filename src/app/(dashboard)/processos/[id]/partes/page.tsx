import { exigirProcessoContrato } from "../processo-dados";
import { PartesSection } from "../partes-section";

// Anexar documento roda o OCR na mesma requisição do server action.
export const maxDuration = 60;

export default async function PartesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const processo = await exigirProcessoContrato(id);

  return <PartesSection cdProcesso={id} numeroProcesso={processo.ds_numero_processo} />;
}
