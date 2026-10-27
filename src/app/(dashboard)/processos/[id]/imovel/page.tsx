import { exigirProcessoContrato } from "../processo-dados";
import { ImovelSection } from "../imovel-section";

export const maxDuration = 60;

export default async function ImovelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirProcessoContrato(id);

  return <ImovelSection cdProcesso={id} />;
}
