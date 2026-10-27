import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { assinaturaConfigurada } from "@/lib/assinatura";
import { MinutaDocView } from "@/components/minuta-doc-view";
import { renderMarcado, semMarcacao } from "@/lib/minuta-marcacao";
import { textoParaDoc } from "@/lib/minuta-doc";
import { cn, formatarDataHora } from "@/lib/utils";
import {
  ETAPA_CONTRATO_LABEL,
  PAPEL_APROVACAO_LABEL,
  type Contrato,
  type ContratoSignatario,
  type Minuta,
  type MinutaAprovacao,
  type MinutaConvite,
  type Processo,
  type TipoPapelAprovacao,
} from "@/types/database";
import { ContratoAssinatura } from "./contrato-assinatura";
import { MinutaDecisaoBotoes } from "./minuta-decisao-botoes";
import { MinutaDeModeloForm } from "./minuta-de-modelo-form";
import { MinutaEditor } from "./minuta-editor";
import { MinutaEnviarEmail } from "./minuta-enviar-email";
import { MinutaUploadForm } from "./minuta-upload-form";

const PAPEIS: TipoPapelAprovacao[] = ["corretor", "comprador", "vendedor", "imobiliaria", "juridico"];

const STATUS_APROVACAO_CLASS: Record<MinutaAprovacao["tp_status"], string> = {
  pendente: "bg-status-pendente/15 text-status-pendente",
  aprovada: "bg-status-aceito/15 text-status-aceito",
  reprovada: "bg-status-reprovado/15 text-status-reprovado",
};

const STATUS_APROVACAO_LABEL: Record<MinutaAprovacao["tp_status"], string> = {
  pendente: "Pendente",
  aprovada: "Aprovada",
  reprovada: "Reprovada",
};

// Mesmo predicado de soma.fn_pode_aprovar_papel — só pra decidir se
// mostra os botões; a RPC ainda é a barreira de verdade.
function podeDecidirPapel(
  papel: TipoPapelAprovacao,
  usuario: { cd_usuario: string; tp_role: string },
  processo: Processo
) {
  if (usuario.tp_role === "master") return true;
  switch (papel) {
    case "corretor":
      return processo.cd_corretor === usuario.cd_usuario;
    case "comprador":
      return processo.cd_comprador === usuario.cd_usuario;
    case "vendedor":
      return processo.cd_vendedor === usuario.cd_usuario;
    case "juridico":
      return usuario.tp_role === "juridico";
    case "imobiliaria":
      return usuario.tp_role === "imobiliaria";
  }
}

export async function MinutaSection({ processo }: { processo: Processo }) {
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const { data: minutas } = await supabase
    .schema("soma")
    .from("minutas")
    .select("*")
    .eq("cd_processo", processo.cd_processo)
    .order("nr_versao", { ascending: false })
    .returns<Minuta[]>();

  const minutaAtual = minutas?.[0] ?? null;

  const [{ data: aprovacoes }, { data: contrato }, { data: convites }] = await Promise.all([
    minutaAtual
      ? supabase
          .schema("soma")
          .from("minuta_aprovacoes")
          .select("*, usuarios(nm_usuario)")
          .eq("cd_minuta", minutaAtual.cd_minuta)
          .returns<(MinutaAprovacao & { usuarios: { nm_usuario: string } | null })[]>()
      : Promise.resolve({ data: null }),
    minutaAtual
      ? supabase
          .schema("soma")
          .from("contratos")
          .select("*")
          .eq("cd_minuta", minutaAtual.cd_minuta)
          .maybeSingle<Contrato>()
      : Promise.resolve({ data: null }),
    minutaAtual
      ? supabase
          .schema("soma")
          .from("minuta_convites")
          .select("*")
          .eq("cd_minuta", minutaAtual.cd_minuta)
          .order("ts_envio")
          .returns<MinutaConvite[]>()
      : Promise.resolve({ data: null }),
  ]);

  let urlMinuta: string | null = null;
  if (minutaAtual?.ds_storage_url) {
    const { data } = await supabase.storage
      .from("minutas")
      .createSignedUrl(minutaAtual.ds_storage_url, 60 * 10);
    urlMinuta = data?.signedUrl ?? null;
  }

  const podeEnviarMinuta =
    (usuario.tp_role === "master" || usuario.tp_role === "juridico") &&
    !contrato;

  let signatarios: ContratoSignatario[] = [];
  let urlContratoAssinado: string | null = null;
  if (contrato) {
    const { data } = await supabase
      .schema("soma")
      .from("contrato_signatarios")
      .select("*")
      .eq("cd_contrato", contrato.cd_contrato)
      .returns<ContratoSignatario[]>();
    signatarios = data ?? [];

    if (contrato.ds_arquivo_assinado_url) {
      const { data: assinado } = await supabase.storage
        .from("minutas")
        .createSignedUrl(contrato.ds_arquivo_assinado_url, 60 * 10);
      urlContratoAssinado = assinado?.signedUrl ?? null;
    }
  }

  const podeReenviarAssinatura =
    usuario.tp_role === "master" || usuario.tp_role === "juridico";

  let modelos: { cd_modelo: string; nm_modelo: string }[] = [];
  if (podeEnviarMinuta) {
    const { data } = await supabase
      .schema("soma")
      .from("modelos_contrato")
      .select("cd_modelo, nm_modelo")
      .eq("sn_ativo", true)
      .order("nm_modelo")
      .returns<{ cd_modelo: string; nm_modelo: string }[]>();
    modelos = data ?? [];
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Minuta do contrato</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {processo.tp_etapa_contrato && (
          <p className="text-sm text-muted-foreground">
            Etapa atual:{" "}
            <strong className="text-foreground">
              {ETAPA_CONTRATO_LABEL[processo.tp_etapa_contrato]}
            </strong>
          </p>
        )}

        {podeEnviarMinuta && (
          <>
            <MinutaDeModeloForm cdProcesso={processo.cd_processo} modelos={modelos} />
            <MinutaUploadForm cdProcesso={processo.cd_processo} />
          </>
        )}

        {minutaAtual && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-radius border border-border p-3">
              <span className="text-sm text-foreground">
                Minuta versão {minutaAtual.nr_versao}
                {urlMinuta && (
                  <a
                    href={urlMinuta}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-2 text-brand underline"
                  >
                    ver arquivo
                  </a>
                )}
              </span>
              <span className="text-xs text-muted-foreground">
                Enviada em {formatarDataHora(minutaAtual.ts_criacao)}
              </span>
            </div>

            {minutaAtual.ds_conteudo && (
              <div className="flex flex-wrap gap-3 text-sm">
                <a
                  href={`/processos/${processo.cd_processo}/minuta/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand underline"
                >
                  Abrir PDF da minuta
                </a>
                <a
                  href={`/processos/${processo.cd_processo}/minuta/pdf?baixar=1`}
                  className="text-brand underline"
                >
                  Baixar PDF
                </a>
              </div>
            )}

            {podeEnviarMinuta && minutaAtual.tp_status === "em_aprovacao" && (
              <MinutaEnviarEmail
                cdMinuta={minutaAtual.cd_minuta}
                jaEnviada={(convites ?? []).length > 0}
                faltamEnviar={(convites ?? []).some((c) => c.tp_status === "pendente" && !c.ts_envio)}
              />
            )}

            {minutaAtual.ds_conteudo && podeEnviarMinuta && (
              <MinutaEditor
                cdMinuta={minutaAtual.cd_minuta}
                // Convertido aqui (servidor) pra que as marcas de "valor do
                // processo" (vermelho) cheguem ao editor como JSON, e não
                // como caracteres de controle dentro de um texto.
                doc={minutaAtual.ds_conteudo_json ?? textoParaDoc(minutaAtual.ds_conteudo)}
              />
            )}

            {minutaAtual.ds_conteudo && (
              <details className="rounded-radius border border-border p-3" open>
                <summary className="cursor-pointer text-sm text-foreground">
                  Ver texto da minuta
                </summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  Em <span className="font-medium text-status-reprovado">vermelho</span>: o que veio
                  dos dados do processo. O PDF enviado pra assinatura sai sem as cores.
                </p>
                {minutaAtual.ds_conteudo_json ? (
                  <div className="mt-2">
                    <MinutaDocView doc={minutaAtual.ds_conteudo_json} />
                  </div>
                ) : (
                  <pre className="mt-2 max-h-[500px] overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                    {renderMarcado(minutaAtual.ds_conteudo)}
                  </pre>
                )}
              </details>
            )}

            <div className="flex flex-col gap-2">
              {PAPEIS.map((papel) => {
                const aprovacao = aprovacoes?.find((a) => a.tp_papel === papel);
                if (!aprovacao) return null;

                return (
                  <div
                    key={papel}
                    className="flex flex-col gap-2 rounded-radius border border-border p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">
                        {PAPEL_APROVACAO_LABEL[papel]}
                        {aprovacao.usuarios?.nm_usuario && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            — {aprovacao.usuarios.nm_usuario}
                          </span>
                        )}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                          STATUS_APROVACAO_CLASS[aprovacao.tp_status]
                        )}
                      >
                        {STATUS_APROVACAO_LABEL[aprovacao.tp_status]}
                      </span>
                    </div>
                    {aprovacao.ds_comentario && (
                      <p className="text-xs text-status-reprovado">{aprovacao.ds_comentario}</p>
                    )}
                    {(convites ?? [])
                      .filter((c) => c.tp_papel === papel)
                      .map((c) => (
                        <div
                          key={c.cd_convite}
                          className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"
                        >
                          <span>
                            {c.nm_destinatario} · {c.ds_email}
                            {c.ds_comentario && (
                              <span className="ml-1 text-status-reprovado">— {c.ds_comentario}</span>
                            )}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 font-medium",
                              STATUS_APROVACAO_CLASS[c.tp_status]
                            )}
                          >
                            {c.tp_status === "pendente"
                              ? c.ts_envio
                                ? `E-mail enviado em ${formatarDataHora(c.ts_envio)}`
                                : "E-mail ainda não enviado"
                              : `${STATUS_APROVACAO_LABEL[c.tp_status]}${c.ts_decisao ? ` em ${formatarDataHora(c.ts_decisao)}` : ""}`}
                          </span>
                        </div>
                      ))}
                    {/* As frentes de fora respondem pelo link do e-mail. Aqui só decide
                        quem não recebe e-mail (Jurídico) ou uma frente que ficou sem
                        ninguém pra receber (ex: processo sem imobiliária). */}
                    {aprovacao.tp_status === "pendente" &&
                      (papel === "juridico" ||
                        ((convites ?? []).length > 0 &&
                          !(convites ?? []).some((c) => c.tp_papel === papel))) &&
                      podeDecidirPapel(papel, usuario, processo) && (
                        <MinutaDecisaoBotoes cdMinuta={minutaAtual.cd_minuta} tpPapel={papel} />
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {contrato && (
          <div className="flex flex-col gap-2 rounded-radius border border-status-liberado/30 bg-status-liberado/5 p-3">
            <p className="text-sm font-medium text-foreground">Contrato final pronto</p>
            {urlMinuta && (
              <a
                href={urlMinuta}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-brand underline"
              >
                Ver contrato
              </a>
            )}
            {!urlMinuta && minutaAtual?.ds_conteudo && (
              <details className="rounded-radius border border-border bg-card p-3">
                <summary className="cursor-pointer text-sm text-foreground">Ver contrato</summary>
                {minutaAtual.ds_conteudo_json ? (
                  <div className="mt-2">
                    <MinutaDocView doc={minutaAtual.ds_conteudo_json} />
                  </div>
                ) : (
                  <pre className="mt-2 max-h-[400px] overflow-auto whitespace-pre-wrap font-mono text-xs text-foreground">
                    {semMarcacao(minutaAtual.ds_conteudo)}
                  </pre>
                )}
              </details>
            )}

            <ContratoAssinatura
              contrato={contrato}
              signatarios={signatarios}
              assinaturaConfigurada={assinaturaConfigurada()}
              podeReenviar={podeReenviarAssinatura}
              urlContratoAssinado={urlContratoAssinado}
            />
          </div>
        )}

        {!minutaAtual && !podeEnviarMinuta && (
          <p className="text-sm text-muted-foreground">
            Documentação ainda em análise — a minuta é enviada pelo Jurídico assim que estiver pronta.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
