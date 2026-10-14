import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checklistDaPessoa, formatarDataIso, parDaParte } from "@/lib/checklist-partes";
import { getSiteUrl } from "@/lib/mercadopago";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda, formatarPercentual } from "@/lib/utils";
import {
  CARTORIOS_IMOVEIS,
  CATEGORIA_DOC_INTAKE_LABEL,
  CATEGORIAS_DOC_IMOVEL,
  LADO_PARTE_LABEL,
  LADOS_COM_CHECKLIST,
  type CategoriaDocIntake,
  type Documento,
  type LadoParte,
  type ProcessoCorretor,
  type ProcessoNegocio,
  type ProcessoParte,
} from "@/types/database";
import { DocumentoAnexarButton } from "./documento-anexar-button";
import { LinkParteButton } from "./link-parte-button";

type DocComUrl = Pick<
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

const moeda = (v: number | null | undefined) => (v == null ? null : formatarMoeda(Number(v)));

// "R$ 9.625,00 (55%)" — o que existir dos dois.
function valorComPercentual(valor: number | null | undefined, percentual: number | null | undefined) {
  if (valor == null && percentual == null) return null;
  if (valor == null) return formatarPercentual(Number(percentual));
  if (percentual == null) return formatarMoeda(Number(valor));
  return `${formatarMoeda(Number(valor))} (${formatarPercentual(Number(percentual))})`;
}

function Selo({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center rounded-full bg-status-aceito/15 px-2.5 py-0.5 text-xs font-medium text-status-aceito">
      OK
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-status-reprovado/15 px-2.5 py-0.5 text-xs font-medium text-status-reprovado">
      Falta
    </span>
  );
}

// Uma linha do checklist: links dos arquivos, botão pra anexar mais um
// (frente e verso) e OK/Falta.
function ItemDocumento({
  rotulo,
  observacao,
  arquivos,
  anexar,
}: {
  rotulo: string;
  observacao?: string | null;
  arquivos: DocComUrl[];
  anexar: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border py-1.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">
        {rotulo}
        {observacao && <span className="ml-1.5 text-xs text-muted-foreground/80">({observacao})</span>}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        {arquivos.map((doc, i) =>
          doc.urlAssinada ? (
            <a
              key={doc.cd_documento}
              href={doc.urlAssinada}
              target="_blank"
              rel="noopener noreferrer"
              title={doc.nm_arquivo}
              className="text-xs text-brand underline"
            >
              {arquivos.length > 1 ? `arquivo ${i + 1}` : "ver arquivo"}
            </a>
          ) : null
        )}
        {anexar}
        <Selo ok={arquivos.length > 0} />
      </span>
    </div>
  );
}

function ParteCard({
  parte,
  todasPartes,
  cdProcesso,
  numeroProcesso,
  linkPreenchimento,
  docsPorParte,
}: {
  parte: ProcessoParte;
  todasPartes: ProcessoParte[];
  cdProcesso: string;
  numeroProcesso: string;
  linkPreenchimento: string | null;
  docsPorParte: Map<string, DocComUrl[]>;
}) {
  const temChecklist = LADOS_COM_CHECKLIST.includes(parte.tp_lado);
  const par = temChecklist ? parDaParte(parte, todasPartes) : null;
  const meus = docsPorParte.get(parte.cd_parte) ?? [];
  const doParceiro = par ? docsPorParte.get(par.parceiro.cd_parte) ?? [] : [];
  const avulsos = meus.filter((d) => !d.tp_categoria_intake);

  const ladoDaParte = todasPartes
    .filter((p) => p.tp_lado === parte.tp_lado)
    .sort((a, b) => a.nr_ordem - b.nr_ordem);
  const posicao = ladoDaParte.findIndex((p) => p.cd_parte === parte.cd_parte);
  const vinculo =
    posicao > 0 && temChecklist
      ? (parte.tp_vinculo ?? "conjuge") === "conjuge"
        ? `cônjuge de ${ladoDaParte[posicao - 1].nm_parte}`
        : parte.tp_vinculo === "companheiro"
          ? `companheiro(a) de ${ladoDaParte[posicao - 1].nm_parte}`
          : "outra pessoa"
      : null;

  return (
    <div className="rounded-radius border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {parte.nm_parte}
          {!temChecklist && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {LADO_PARTE_LABEL[parte.tp_lado]}
            </span>
          )}
          {vinculo && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">— {vinculo}</span>
          )}
        </p>
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
        <Linha rotulo="CPF" valor={parte.ds_cpf} />
        <Linha rotulo="RG" valor={parte.ds_rg} />
        <Linha rotulo="Nascimento" valor={formatarDataIso(parte.dt_nascimento)} />
        <Linha rotulo="Telefone" valor={parte.ds_telefone} />
        <Linha rotulo="E-mail" valor={parte.ds_email} />
        <Linha rotulo="Profissão" valor={parte.ds_profissao} />
        <Linha rotulo="Endereço" valor={parte.ds_endereco} />
        <Linha rotulo="Conta bancária" valor={parte.ds_conta_bancaria} />
        <Linha rotulo="Observações" valor={parte.ds_documentos_obs} />
      </div>

      <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">Documentos</p>
      <div className="flex flex-col">
        {temChecklist &&
          checklistDaPessoa(par?.vinculo ?? null).map((item) => {
            const arquivos = [
              ...meus.filter((d) => d.tp_categoria_intake === item.categoria),
              ...(item.compartilhado
                ? doParceiro.filter((d) => d.tp_categoria_intake === item.categoria)
                : []),
            ];
            return (
              <ItemDocumento
                key={item.categoria}
                rotulo={CATEGORIA_DOC_INTAKE_LABEL[item.categoria]}
                observacao={item.compartilhado && par ? `vale pro casal, com ${par.parceiro.nm_parte}` : null}
                arquivos={arquivos}
                anexar={
                  <DocumentoAnexarButton
                    cdProcesso={cdProcesso}
                    cdParte={parte.cd_parte}
                    tpLado={parte.tp_lado}
                    tpCategoria={item.categoria}
                    rotuloCategoria={CATEGORIA_DOC_INTAKE_LABEL[item.categoria]}
                    rotuloBotao={arquivos.length > 0 ? "+ arquivo" : "Anexar"}
                  />
                }
              />
            );
          })}

        {!temChecklist && avulsos.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum documento anexado.</p>
        )}

        {avulsos.map((doc) => (
          <div
            key={doc.cd_documento}
            className="flex items-center justify-between gap-3 border-t border-border py-1.5 text-sm first:border-t-0"
          >
            <span className="min-w-0 truncate text-muted-foreground">{doc.nm_arquivo}</span>
            {doc.urlAssinada && (
              <a
                href={doc.urlAssinada}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-brand underline"
              >
                ver arquivo
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const PLURAL_LADO: Record<LadoParte, string> = {
  vendedor: "Vendedores",
  comprador: "Compradores",
  corretor: "Corretores",
  imobiliaria: "Imobiliárias",
  adm: "Administradores",
  cliente: "Clientes",
};

const ORDEM_LADO: LadoParte[] = [
  "vendedor",
  "comprador",
  "corretor",
  "imobiliaria",
  "adm",
  "cliente",
];

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
        .order("nr_ordem")
        .returns<ProcessoParte[]>(),
      supabase
        .schema("soma")
        .from("processo_corretor")
        .select("*")
        .eq("cd_processo", cdProcesso)
        .order("nr_ordem")
        .returns<ProcessoCorretor[]>(),
      supabase
        .schema("soma")
        .from("documentos")
        .select("cd_documento, cd_parte, tp_categoria_intake, nm_arquivo, ds_storage_url")
        .eq("cd_processo", cdProcesso)
        .or("cd_parte.not.is.null,tp_categoria_intake.not.is.null")
        .order("ts_criacao")
        .returns<Omit<DocComUrl, "urlAssinada">[]>(),
    ]);

  const docsComUrl = await Promise.all(
    (documentos ?? []).map(async (doc): Promise<DocComUrl> => {
      const { data } = await supabase.storage
        .from("documentos")
        .createSignedUrl(doc.ds_storage_url, 60 * 10);
      return { ...doc, urlAssinada: data?.signedUrl ?? null };
    })
  );

  // Documentos do imóvel valem pro processo todo, não importa quem mandou.
  const ehDoImovel = (d: DocComUrl) =>
    CATEGORIAS_DOC_IMOVEL.includes(d.tp_categoria_intake as CategoriaDocIntake);
  const docsImovel = docsComUrl.filter(ehDoImovel);

  const docsPorParte = new Map<string, DocComUrl[]>();
  for (const doc of docsComUrl) {
    if (!doc.cd_parte || ehDoImovel(doc)) continue;
    const lista = docsPorParte.get(doc.cd_parte) ?? [];
    lista.push(doc);
    docsPorParte.set(doc.cd_parte, lista);
  }

  const todasPartes = partes ?? [];
  const grupos = ORDEM_LADO.map((lado) => ({
    lado,
    partes: todasPartes.filter((p) => p.tp_lado === lado),
  })).filter((g) => g.partes.length > 0);

  const temAlgo = negocio || todasPartes.length > 0 || (corretores ?? []).length > 0;
  const cartorio = CARTORIOS_IMOVEIS.find((c) => c.codigo === negocio?.ds_imovel_cartorio);

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

        {grupos.map((grupo) => (
          <div key={grupo.lado} className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">
              {grupo.partes.length > 1 ? PLURAL_LADO[grupo.lado] : LADO_PARTE_LABEL[grupo.lado]}
            </p>
            {grupo.partes.map((p) => (
              <ParteCard
                key={p.cd_parte}
                parte={p}
                todasPartes={todasPartes}
                cdProcesso={cdProcesso}
                numeroProcesso={numeroProcesso}
                linkPreenchimento={
                  linkBase && p.cd_token_parte ? `${linkBase}/parte/${p.cd_token_parte}` : null
                }
                docsPorParte={docsPorParte}
              />
            ))}
          </div>
        ))}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Imóvel</p>
          <div className="rounded-radius border border-border p-3">
            {negocio && (
              <>
                <Linha rotulo="Endereço" valor={negocio.ds_imovel_endereco} />
                <Linha rotulo="Matrícula" valor={negocio.ds_imovel_matricula} />
                <Linha rotulo="Inscrição municipal (IPTU)" valor={negocio.ds_imovel_iptu} />
                <Linha rotulo="Cartório de imóveis" valor={cartorio?.rotulo} />
                <Linha rotulo="Valor do imóvel" valor={moeda(negocio.vl_imovel)} />
                <Linha
                  rotulo="Forma de pagamento"
                  valor={
                    negocio.tp_pagamento === "financiado"
                      ? "Financiado"
                      : negocio.tp_pagamento === "a_vista"
                        ? "À vista"
                        : null
                  }
                />
                <Linha rotulo="Sinal" valor={moeda(negocio.vl_sinal)} />
                <Linha rotulo="Entrada" valor={moeda(negocio.vl_entrada)} />
                <Linha
                  rotulo="Usa FGTS?"
                  valor={
                    negocio.sn_usa_fgts === null
                      ? null
                      : negocio.sn_usa_fgts
                        ? `Sim${negocio.vl_fgts != null ? ` — ${formatarMoeda(Number(negocio.vl_fgts))}` : ""}`
                        : "Não"
                  }
                />
                <Linha rotulo="Saldo financiado" valor={moeda(negocio.vl_financiamento)} />
                <Linha rotulo="Saldo para quitação" valor={moeda(negocio.vl_saldo_quitacao)} />
                <Linha rotulo="Banco" valor={negocio.ds_banco} />
                <Linha rotulo="Possui inquilino?" valor={simNao(negocio.sn_possui_inquilino)} />
                <Linha rotulo="Está ocupado?" valor={simNao(negocio.sn_ocupado)} />
                <Linha rotulo="Entrega das chaves" valor={negocio.ds_entrega_chaves} />
                <Linha rotulo="O que fica no imóvel" valor={negocio.ds_itens_imovel} />
              </>
            )}

            <p className="mt-3 mb-1 text-xs font-medium text-muted-foreground">
              Documentos do imóvel
            </p>
            {CATEGORIAS_DOC_IMOVEL.map((categoria) => {
              const arquivos = docsImovel.filter((d) => d.tp_categoria_intake === categoria);
              return (
                <ItemDocumento
                  key={categoria}
                  rotulo={CATEGORIA_DOC_INTAKE_LABEL[categoria]}
                  arquivos={arquivos}
                  anexar={
                    <DocumentoAnexarButton
                      cdProcesso={cdProcesso}
                      cdParte={null}
                      tpLado={null}
                      tpCategoria={categoria}
                      rotuloCategoria={CATEGORIA_DOC_INTAKE_LABEL[categoria]}
                      rotuloBotao={arquivos.length > 0 ? "+ arquivo" : "Anexar"}
                    />
                  }
                />
              );
            })}
          </div>
        </div>

        {(negocio || (corretores ?? []).length > 0) && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Honorários</p>
            <div className="rounded-radius border border-border p-3">
              <Linha
                rotulo="Valor total"
                valor={
                  negocio?.vl_honorarios_total != null
                    ? `${formatarMoeda(Number(negocio.vl_honorarios_total))}${
                        negocio.pc_honorarios_total != null
                          ? ` (${formatarPercentual(Number(negocio.pc_honorarios_total))} do imóvel)`
                          : ""
                      }`
                    : null
                }
              />
              <Linha rotulo="Quando" valor={negocio?.ds_honorarios_quando} />
              <Linha
                rotulo="Honorários da imobiliária"
                valor={valorComPercentual(
                  negocio?.vl_honorarios_imobiliaria,
                  negocio?.pc_honorarios_imobiliaria
                )}
              />
              {(corretores ?? []).map((c) => (
                <Linha
                  key={c.cd_processo_corretor}
                  rotulo={`Corretor — ${c.nm_corretor}`}
                  valor={valorComPercentual(c.vl_honorario, c.pc_honorario) ?? "—"}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
