import { DocumentosSection } from "../../../orcamentos/[id]/documentos-section";
import { exigirProcessoContrato } from "../processo-dados";

export const maxDuration = 60;

export default async function DocumentosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await exigirProcessoContrato(id);

  return <DocumentosSection cdProcesso={id} />;
}
