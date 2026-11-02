import { FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { exigirProcessoContrato } from "../processo-dados";
import { VistoriaAmbientes, type AmbienteVista } from "./vistoria-ambientes";

// Subir foto lê/redimensiona imagem; descrever pela IA lê várias fotos.
export const maxDuration = 60;

const PODE_EDITAR = new Set(["master", "juridico"]);

export default async function VistoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const processo = await exigirProcessoContrato(id);
  if (processo.tp_contrato !== "locacao") notFound();

  const usuario = await getUsuarioAtual();
  const supabase = await createClient();

  const { data: ambientes } = await supabase
    .schema("soma")
    .from("vistoria_ambientes")
    .select("cd_ambiente, nm_ambiente, ds_descricao, vistoria_fotos(cd_foto, ds_storage_url, nr_ordem)")
    .eq("cd_processo", id)
    .order("nr_ordem")
    .returns<
      {
        cd_ambiente: string;
        nm_ambiente: string;
        ds_descricao: string | null;
        vistoria_fotos: { cd_foto: string; ds_storage_url: string; nr_ordem: number }[];
      }[]
    >();

  const vista: AmbienteVista[] = await Promise.all(
    (ambientes ?? []).map(async (a) => ({
      cd_ambiente: a.cd_ambiente,
      nm_ambiente: a.nm_ambiente,
      ds_descricao: a.ds_descricao,
      fotos: await Promise.all(
        [...a.vistoria_fotos]
          .sort((x, y) => x.nr_ordem - y.nr_ordem)
          .map(async (f) => {
            const { data } = await supabase.storage.from("documentos").createSignedUrl(f.ds_storage_url, 60 * 30);
            return { cd_foto: f.cd_foto, url: data?.signedUrl ?? null };
          })
      ),
    }))
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Termo de Vistoria</CardTitle>
        {vista.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <a
              href={`/processos/${id}/vistoria/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-brand underline"
            >
              <FileText className="h-3.5 w-3.5" />
              Abrir PDF
            </a>
            <a href={`/processos/${id}/vistoria/pdf?baixar=1`} className="text-brand underline">
              Baixar
            </a>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Cadastre cada ambiente do imóvel, envie as fotos e peça a descrição — a IA sugere o texto
          pelas fotos e você confere antes de salvar. O PDF reúne locador, locatário, imóvel, as
          cláusulas do laudo e os ambientes com as fotos. Quanto mais detalhadas as fotos (móveis,
          eletrodomésticos, avarias), mais completo o termo.
        </p>
        {PODE_EDITAR.has(usuario.tp_role) ? (
          <VistoriaAmbientes cdProcesso={id} ambientes={vista} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {vista.length === 0 ? "Nenhum ambiente cadastrado." : `${vista.length} ambiente(s) cadastrado(s).`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
