import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSiteUrl } from "@/lib/mercadopago";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import {
  CATEGORIA_DOC_INTAKE_LABEL,
  CATEGORIAS_DOC_COMPRADOR,
  CATEGORIAS_DOC_VENDEDOR,
  type CategoriaDocIntake,
  type Documento,
  type ProcessoCorretor,
  type ProcessoNegocio,
  type ProcessoParte,
} from "@/types/database";
import { DocumentoAnexarButton } from "./documento-anexar-button";
import { LinkParteButton } from "./link-parte-button";

type DocDaParte = Pick<
  Documento,
  "cd_documento" | "cd_parte" | "tp_categoria_intake" | "nm_arquivo" | "ds_storage_url"
> & { urlAssinada: string | null };

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (valor === null || valor === undefined || valor === "") return null;
  return (
    <div className="flex justify-between gap-4 border-t border-border py-1.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">{rotulo}</span>
      <span className="text-right text-foreground">{valor}</span>
    </div>
  );
}

function simNao(v: boolean | null) {
  if (v === null) return null;
  return v ? "Sim" : "Não";
}

function ParteCard({
  parte,
  cdProcesso,
  numeroProcesso,
  linkPreenchimento,
  categorias,
  docsPorCategoria,
}: {
  parte: ProcessoParte;
  cdProcesso: string;
  numeroProcesso: string;
  linkPreenchimento: string | null;
  categorias: CategoriaDocIntake[];
  docsPorCategoria: Map<string, DocDaParte>;
}) {
  return (
    <div className="rounded-radius border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{parte.nm_parte}</p>
        {linkPreenchimento && (
          <LinkParteButton
            link={linkPreenchimento}
            telefone={parte.ds_telefone}
            nome={parte.nm_parte}
            numeroProcesso={numeroProcesso}
          />
        )}
      </div>
      <div className="mt-1 flex flex-col">
        <Linha rotulo="Telefone" valor={parte.ds_telefone} />
        <Linha rotulo="E-mail" valor={parte.ds_email} />
        <Linha rotulo="Profissão" valor={parte.ds_profissao} />
        <Linha rotulo="Conta bancária" valor={parte.ds_conta_bancaria} />
        <Linha rotulo="Observações" valor={parte.ds_documentos_obs} />
      </div>

      <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Documentos</p>
      <div className="flex flex-col">
        {categorias.map((categoria) => {
          const doc = docsPorCategoria.get(categoria);
          return (
            <div
              key={categoria}
              className="flex items-center justify-between gap-3 border-t border-border py-1.5 text-sm first:border-t-0"
            >
              <span className="text-muted-foreground">
                {CATEGORIA_DOC_INTAKE_LABEL[categoria]}
              </span>
              {doc ? (
                <span className="flex items-center gap-2">
                  {doc.urlAssinada && (
                    <a
                      href={doc.urlAssinada}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand underline"
                    >
                      ver arquivo
                    </a>
                  )}
                  <span className="inline-flex items-center rounded-full bg-status-aceito/15 px-2.5 py-0.5 text-xs font-medium text-status-aceito">
                    OK
                  </span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <DocumentoAnexarButton
                    cdProcesso={cdProcesso}
                    cdParte={parte.cd_parte}
                    tpLado={parte.tp_lado}
                    tpCategoria={categoria}
                    rotuloCategoria={CATEGORIA_DOC_INTAKE_LABEL[categoria]}
                  />
                  <span className="inline-flex items-center rounded-full bg-status-reprovado/15 px-2.5 py-0.5 text-xs font-medium text-status-reprovado">
                    Falta
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function DadosNegocioSection({
  cdProcesso,
  numeroProcesso,
}: {
  cdProcesso: string;
  numeroProcesso: string;
}) {
  const supabase = await createClient();
  const linkBase = getSiteUrl();

  const [{ data: negocio }, { data: partes }, { data: corretores }, { data: documentos }] =
    await Promise.all([
      supabase
        .schema("soma")
        .from("processo_negocio")
        .select("*")
        .eq("cd_processo", cdProcesso)
        .maybeSingle<ProcessoNegocio>(),
      supabase
        .schema("soma")
        .from("processo_parte")
        .select("*")
        .eq("cd_processo", cdProcesso)
        .order("tp_lado")
        .order("nr_ordem")
        .returns<ProcessoParte[]>(),
      supabase
        .schema("soma")
        .from("processo_corretor")
        .select("*")
        .eq("cd_processo", cdProcesso)
        .returns<ProcessoCorretor[]>(),
      supabase
        .schema("soma")
        .from("documentos")
        .select("cd_documento, cd_parte, tp_categoria_intake, nm_arquivo, ds_storage_url")
        .eq("cd_processo", cdProcesso)
        .not("cd_parte", "is", null)
        .not("tp_categoria_intake", "is", null)
        .returns<Omit<DocDaParte, "urlAssinada">[]>(),
    ]);

  // (cd_parte -> (categoria -> documento com URL assinada))
  const docsPorParte = new Map<string, Map<string, DocDaParte>>();
  await Promise.all(
    (documentos ?? []).map(async (doc) => {
      const { data } = await supabase.storage
        .from("documentos")
        .createSignedUrl(doc.ds_storage_url, 60 * 10);
      const comUrl: DocDaParte = { ...doc, urlAssinada: data?.signedUrl ?? null };
      const porCategoria = docsPorParte.get(doc.cd_parte!) ?? new Map<string, DocDaParte>();
      porCategoria.set(doc.tp_categoria_intake!, comUrl);
      docsPorParte.set(doc.cd_parte!, porCategoria);
    })
  );

  const vendedores = (partes ?? []).filter((p) => p.tp_lado === "vendedor");
  const compradores = (partes ?? []).filter((p) => p.tp_lado === "comprador");
  const temAlgo =
    negocio || vendedores.length > 0 || compradores.length > 0 || (corretores ?? []).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados do negócio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!temAlgo && (
          <p className="text-sm text-muted-foreground">
            Nenhum dado do negócio informado na abertura do processo.
          </p>
        )}

        {vendedores.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Vendedores</p>
            {vendedores.map((p) => (
              <ParteCard
                key={p.cd_parte}
                parte={p}
                cdProcesso={cdProcesso}
                numeroProcesso={numeroProcesso}
                linkPreenchimento={
                  linkBase && p.cd_token_parte ? `${linkBase}/parte/${p.cd_token_parte}` : null
                }
                categorias={CATEGORIAS_DOC_VENDEDOR}
                docsPorCategoria={docsPorParte.get(p.cd_parte) ?? new Map()}
              />
            ))}
          </div>
        )}

        {compradores.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Compradores</p>
            {compradores.map((p) => (
              <ParteCard
                key={p.cd_parte}
                parte={p}
                cdProcesso={cdProcesso}
                numeroProcesso={numeroProcesso}
                linkPreenchimento={
                  linkBase && p.cd_token_parte ? `${linkBase}/parte/${p.cd_token_parte}` : null
                }
                categorias={CATEGORIAS_DOC_COMPRADOR}
                docsPorCategoria={docsPorParte.get(p.cd_parte) ?? new Map()}
              />
            ))}
          </div>
        )}

        {negocio && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Imóvel</p>
            <div className="rounded-radius border border-border p-3">
              <Linha
                rotulo="Valor do imóvel"
                valor={negocio.vl_imovel !== null ? formatarMoeda(negocio.vl_imovel) : null}
              />
              <Linha
                rotulo="Valor de entrada"
                valor={negocio.vl_entrada !== null ? formatarMoeda(negocio.vl_entrada) : null}
              />
              <Linha
                rotulo="Valor do financiamento"
                valor={
                  negocio.vl_financiamento !== null
                    ? formatarMoeda(negocio.vl_financiamento)
                    : null
                }
              />
              <Linha rotulo="Banco" valor={negocio.ds_banco} />
              <Linha rotulo="Possui inquilino?" valor={simNao(negocio.sn_possui_inquilino)} />
              <Linha rotulo="Está ocupado?" valor={simNao(negocio.sn_ocupado)} />
              <Linha rotulo="Entrega das chaves" valor={negocio.ds_entrega_chaves} />
              <Linha rotulo="O que fica no imóvel" valor={negocio.ds_itens_imovel} />
            </div>
          </div>
        )}

        {(negocio || (corretores ?? []).length > 0) && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Honorários</p>
            <div className="rounded-radius border border-border p-3">
              <Linha
                rotulo="Valor total"
                valor={
                  negocio?.vl_honorarios_total != null
                    ? formatarMoeda(negocio.vl_honorarios_total)
                    : null
                }
              />
              <Linha rotulo="Quando" valor={negocio?.ds_honorarios_quando} />
              <Linha
                rotulo="Honorários da imobiliária"
                valor={
                  negocio?.vl_honorarios_imobiliaria != null
                    ? formatarMoeda(negocio.vl_honorarios_imobiliaria)
                    : null
                }
              />
              {(corretores ?? []).map((c) => (
                <Linha
                  key={c.cd_processo_corretor}
                  rotulo={`Corretor — ${c.nm_corretor}`}
                  valor={c.vl_honorario != null ? formatarMoeda(c.vl_honorario) : "—"}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
