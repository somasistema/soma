import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { carregarPartesResumo, rotuloDocumento } from "@/lib/rotulo-documento";
import { cn } from "@/lib/utils";
import {
  STATUS_OCR_LABEL,
  TIPO_DOCUMENTO_OCR_LABEL,
  type Documento,
  type DocumentoOcr,
  type DocumentoOcrCampo,
} from "@/types/database";
import { DocumentoOcrPainel } from "../../../orcamentos/[id]/documento-ocr-painel";

// "reprocessar" roda o OCR (Tesseract) dentro do server action desta página.
export const maxDuration = 60;

function classeConfianca(confianca: number | null) {
  if (confianca === null) return "text-muted-foreground";
  if (confianca < 60) return "text-status-reprovado";
  if (confianca < 85) return "text-status-pendente";
  return "text-status-aceito";
}

// Relatório à parte da leitura automática: os documentos já entram
// validados; aqui fica só a conferência do que o OCR/IA leu, com os de
// menor confiança primeiro.
export default async function LeituraDocumentosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: processo } = await supabase
    .schema("soma")
    .from("processos")
    .select("cd_processo, ds_numero_processo")
    .eq("cd_processo", id)
    .maybeSingle<{ cd_processo: string; ds_numero_processo: string }>();

  if (!processo) notFound();

  const { data: documentos } = await supabase
    .schema("soma")
    .from("documentos")
    .select("*")
    .eq("cd_processo", id)
    .order("ts_criacao")
    .returns<Documento[]>();

  const partes = await carregarPartesResumo(supabase, id);
  const ids = (documentos ?? []).map((d) => d.cd_documento);

  const { data: ocrs } = ids.length
    ? await supabase
        .schema("soma")
        .from("documento_ocr")
        .select("*")
        .in("cd_documento", ids)
        .returns<DocumentoOcr[]>()
    : { data: [] as DocumentoOcr[] };

  const idsOcr = (ocrs ?? []).map((o) => o.cd_documento_ocr);
  const { data: campos } = idsOcr.length
    ? await supabase
        .schema("soma")
        .from("documento_ocr_campos")
        .select("*")
        .in("cd_documento_ocr", idsOcr)
        .order("nm_campo")
        .returns<DocumentoOcrCampo[]>()
    : { data: [] as DocumentoOcrCampo[] };

  const ocrPorDocumento = new Map((ocrs ?? []).map((o) => [o.cd_documento, o]));
  const camposPorOcr = new Map<string, DocumentoOcrCampo[]>();
  for (const campo of campos ?? []) {
    const lista = camposPorOcr.get(campo.cd_documento_ocr) ?? [];
    lista.push(campo);
    camposPorOcr.set(campo.cd_documento_ocr, lista);
  }

  const linhas = (documentos ?? [])
    .map((doc) => {
      const ocr = ocrPorDocumento.get(doc.cd_documento) ?? null;
      const camposDoc = ocr ? camposPorOcr.get(ocr.cd_documento_ocr) ?? [] : [];
      const confianca = typeof ocr?.nr_confianca === "number" ? Math.round(ocr.nr_confianca) : null;
      const iaDiscorda =
        ocr?.sn_tipo_confere_ia === false || camposDoc.some((c) => c.sn_confere_ia === false && !c.sn_confirmado);
      return { doc, ocr, campos: camposDoc, confianca, iaDiscorda };
    })
    // Menor confiança (e sem leitura) primeiro — é o que vale olhar.
    .sort((a, b) => (a.confianca ?? -1) - (b.confianca ?? -1));

  return (
    <FadeIn className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/processos/${id}`}
          className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao processo
        </Link>
        <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
          Leitura automática dos documentos
        </h1>
        <p className="text-sm text-muted-foreground">
          Processo {processo.ds_numero_processo}. Os documentos já entram validados — este
          relatório é só pra conferir, quando quiser, o que a leitura automática extraiu (usado
          pra preencher CPF/RG na minuta).
        </p>
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</p>
      ) : (
        <>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Documento</th>
                    <th className="px-4 py-2 font-medium">Tipo detectado</th>
                    <th className="px-4 py-2 font-medium">Confiança</th>
                    <th className="px-4 py-2 font-medium">Campos</th>
                    <th className="px-4 py-2 font-medium">IA</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(({ doc, ocr, campos: camposDoc, confianca, iaDiscorda }) => (
                    <tr key={doc.cd_documento} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2">
                        <a href={`#doc-${doc.cd_documento}`} className="text-foreground hover:underline">
                          {rotuloDocumento(doc, partes)}
                        </a>
                        <p className="max-w-[260px] truncate text-xs text-muted-foreground">
                          {doc.nm_arquivo}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {ocr?.tp_status === "concluido" && ocr.tp_documento_detectado
                          ? TIPO_DOCUMENTO_OCR_LABEL[ocr.tp_documento_detectado]
                          : STATUS_OCR_LABEL[ocr?.tp_status ?? "na_fila"]}
                      </td>
                      <td className={cn("px-4 py-2 font-medium", classeConfianca(confianca))}>
                        {confianca !== null ? `${confianca}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{camposDoc.length}</td>
                      <td className="px-4 py-2 text-xs">
                        {iaDiscorda ? (
                          <span className="text-status-reprovado">discorda</span>
                        ) : ocr?.ts_validacao_ia ? (
                          <span className="inline-flex items-center gap-1 text-status-aceito">
                            <Sparkles className="h-3 w-3" /> conferido
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Detalhe por documento</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {linhas.map(({ doc, ocr, campos: camposDoc }) => (
                <div key={doc.cd_documento} id={`doc-${doc.cd_documento}`} className="flex flex-col gap-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {rotuloDocumento(doc, partes)}
                  </p>
                  <DocumentoOcrPainel cdDocumento={doc.cd_documento} ocr={ocr} campos={camposDoc} />
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </FadeIn>
  );
}
