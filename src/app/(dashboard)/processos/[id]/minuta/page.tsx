import { MinutaSection } from "../minuta-section";
import { exigirProcessoContrato } from "../processo-dados";

export default async function MinutaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const processo = await exigirProcessoContrato(id);

  return <MinutaSection processo={processo} />;
}
