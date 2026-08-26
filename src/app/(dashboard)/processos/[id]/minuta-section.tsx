import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, formatarDataHora } from "@/lib/utils";
import {
  ETAPA_CONTRATO_LABEL,
  PAPEL_APROVACAO_LABEL,
  type Contrato,
  type Minuta,
  type MinutaAprovacao,
  type Processo,
  type TipoPapelAprovacao,
} from "@/types/database";
import { MinutaDecisaoBotoes } from "./minuta-decisao-botoes";
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

  const [{ data: aprovacoes }, { data: contrato }] = await Promise.all([
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
  ]);

  let urlMinuta: string | null = null;
  if (minutaAtual) {
    const { data } = await supabase.storage
      .from("minutas")
      .createSignedUrl(minutaAtual.ds_storage_url, 60 * 10);
    urlMinuta = data?.signedUrl ?? null;
  }

  const podeEnviarMinuta =
    (usuario.tp_role === "master" || usuario.tp_role === "juridico") &&
    (!minutaAtual || minutaAtual.tp_status === "reprovada") &&
    !contrato;

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

        {podeEnviarMinuta && <MinutaUploadForm cdProcesso={processo.cd_processo} />}

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
                    {aprovacao.tp_status === "pendente" &&
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
            <button
              type="button"
              disabled
              title="Assinatura digital via Autentique — em breve"
              className="flex h-9 w-fit cursor-not-allowed items-center gap-1.5 rounded-radius border border-border px-3 text-sm font-medium text-muted-foreground opacity-60"
            >
              Enviar para assinatura (em breve)
            </button>
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
