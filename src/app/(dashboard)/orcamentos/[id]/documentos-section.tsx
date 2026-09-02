import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggerList, StaggerItem } from "@/components/motion/stagger-list";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatarData } from "@/lib/utils";
import {
  PERFIL_DOCUMENTO_LABEL,
  STATUS_DOCUMENTO_LABEL,
  type Documento,
  type DocumentoOcr,
  type DocumentoOcrCampo,
} from "@/types/database";
import { DocumentoOcrPainel } from "./documento-ocr-painel";
import { DocumentoUploadForm } from "./documento-upload-form";
import { DocumentoValidarBotoes } from "./documento-validar-botoes";

const STATUS_CLASS: Record<Documento["tp_status"], string> = {
  pendente: "bg-status-pendente/15 text-status-pendente",
  validado: "bg-status-aceito/15 text-status-aceito",
  rejeitado: "bg-status-reprovado/15 text-status-reprovado",
};

// Quem pode validar/rejeitar documento — mesmo predicado da RLS
// (soma.documentos_update): Master, Jurídico ou Despachante do processo.
// Aqui simplificamos pro papel do usuário; a policy de RLS ainda é a
// barreira de verdade se o Despachante não for o do processo.
const PODE_VALIDAR = new Set(["master", "juridico", "despachante"]);

export async function DocumentosSection({ cdProcesso }: { cdProcesso: string }) {
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const { data: documentos } = await supabase
    .schema("soma")
    .from("documentos")
    .select("*")
    .eq("cd_processo", cdProcesso)
    .order("ts_criacao", { ascending: false })
    .returns<Documento[]>();

  const documentosComUrl = await Promise.all(
    (documentos ?? []).map(async (documento) => {
      const { data } = await supabase.storage
        .from("documentos")
        .createSignedUrl(documento.ds_storage_url, 60 * 10);
      return { ...documento, urlAssinada: data?.signedUrl ?? null };
    })
  );

  const idsDocumentos = documentosComUrl.map((d) => d.cd_documento);

  const { data: ocrs } = idsDocumentos.length
    ? await supabase
        .schema("soma")
        .from("documento_ocr")
        .select("*")
        .in("cd_documento", idsDocumentos)
        .returns<DocumentoOcr[]>()
    : { data: [] as DocumentoOcr[] };

  const idsOcr = (ocrs ?? []).map((o) => o.cd_documento_ocr);

  const { data: camposOcr } = idsOcr.length
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
  for (const campo of camposOcr ?? []) {
    const lista = camposPorOcr.get(campo.cd_documento_ocr) ?? [];
    lista.push(campo);
    camposPorOcr.set(campo.cd_documento_ocr, lista);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documentos do processo</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <DocumentoUploadForm cdProcesso={cdProcesso} />

        {documentosComUrl.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</p>
        ) : (
          <StaggerList className="flex flex-col gap-2">
            {documentosComUrl.map((documento) => (
              <StaggerItem
                key={documento.cd_documento}
                className="flex flex-col gap-2 rounded-radius border border-border p-3"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {documento.urlAssinada ? (
                        <a
                          href={documento.urlAssinada}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand underline"
                        >
                          {documento.nm_tipo_documento}
                        </a>
                      ) : (
                        documento.nm_tipo_documento
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {PERFIL_DOCUMENTO_LABEL[documento.tp_perfil_alvo]} — {documento.nm_arquivo} —{" "}
                      enviado em {formatarData(documento.ts_criacao)}
                    </p>
                    {documento.ds_observacoes && (
                      <p className="text-xs text-status-reprovado">{documento.ds_observacoes}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[documento.tp_status]}`}
                    >
                      {STATUS_DOCUMENTO_LABEL[documento.tp_status]}
                    </span>
                    {documento.tp_status === "pendente" && PODE_VALIDAR.has(usuario.tp_role) && (
                      <DocumentoValidarBotoes cdDocumento={documento.cd_documento} />
                    )}
                  </div>
                </div>

                {(() => {
                  const ocr = ocrPorDocumento.get(documento.cd_documento) ?? null;
                  const campos = ocr ? camposPorOcr.get(ocr.cd_documento_ocr) ?? [] : [];
                  return (
                    <DocumentoOcrPainel
                      cdDocumento={documento.cd_documento}
                      ocr={ocr}
                      campos={campos}
                    />
                  );
                })()}
              </StaggerItem>
            ))}
          </StaggerList>
        )}
      </CardContent>
    </Card>
  );
}
