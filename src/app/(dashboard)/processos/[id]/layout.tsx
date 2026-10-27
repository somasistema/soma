import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { buttonVariants } from "@/components/ui/button-variants";
import { FadeIn } from "@/components/motion/fade-in";
import { getUsuarioAtual, temPermissao } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import { ETAPA_CONTRATO_LABEL, TIPO_PROCESSO_LABEL } from "@/types/database";
import { EtapasProgresso } from "./etapas-progresso";
import { ExcluirProcessoButton } from "./excluir-processo-button";
import { ProcessoAbas, type AbaProcesso } from "./processo-abas";
import { carregarProcesso } from "./processo-dados";

// Upload de documento roda o OCR (Tesseract) na mesma requisição do
// server action — precisa de mais que o default da plataforma.
export const maxDuration = 60;

const PODE_EDITAR = new Set(["master", "juridico"]);

function nomes(lista: { nm_parte: string }[]) {
  if (lista.length === 0) return "—";
  if (lista.length <= 2) return lista.map((p) => p.nm_parte).join(" e ");
  return `${lista[0].nm_parte} e mais ${lista.length - 1}`;
}

export default async function ProcessoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const usuario = await getUsuarioAtual();

  const processo = await carregarProcesso(id);

  if (!processo) notFound();

  const contrato = processo.tp_processo === "contrato";

  const [podeExcluir, { data: partes }, { data: negocio }, { count: pendenciasAbertas }] =
    await Promise.all([
      temPermissao(usuario, "processos", "excluir"),
      supabase
        .schema("soma")
        .from("processo_parte")
        .select("nm_parte, tp_lado, nr_ordem")
        .eq("cd_processo", id)
        .in("tp_lado", ["vendedor", "comprador"])
        .order("nr_ordem")
        .returns<{ nm_parte: string; tp_lado: string; nr_ordem: number }[]>(),
      supabase
        .schema("soma")
        .from("processo_negocio")
        .select("vl_imovel")
        .eq("cd_processo", id)
        .maybeSingle<{ vl_imovel: number | null }>(),
      supabase
        .schema("soma")
        .from("pendencias")
        .select("cd_pendencia", { count: "exact", head: true })
        .eq("cd_processo", id)
        .neq("tp_status", "concluida"),
    ]);

  const base = `/processos/${id}`;
  const abas: AbaProcesso[] = [
    { href: base, rotulo: "Resumo", contador: pendenciasAbertas },
    ...(contrato
      ? [
          { href: `${base}/partes`, rotulo: "Partes" },
          { href: `${base}/imovel`, rotulo: "Imóvel e valores" },
          { href: `${base}/documentos`, rotulo: "Documentos" },
          { href: `${base}/minuta`, rotulo: "Minuta e contrato" },
        ]
      : []),
    { href: `${base}/orcamentos`, rotulo: "Orçamentos" },
    { href: `${base}/atividade`, rotulo: "Atividade" },
  ];

  const vendedores = (partes ?? []).filter((p) => p.tp_lado === "vendedor");
  const compradores = (partes ?? []).filter((p) => p.tp_lado === "comprador");
  const podeEditar = contrato && PODE_EDITAR.has(usuario.tp_role);

  return (
    <FadeIn className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-serif-doc text-2xl font-semibold text-foreground">
              Processo {processo.ds_numero_processo}
            </h1>
            <p className="text-sm text-muted-foreground">
              {TIPO_PROCESSO_LABEL[processo.tp_processo]}
              {processo.tp_etapa_contrato
                ? ` · ${ETAPA_CONTRATO_LABEL[processo.tp_etapa_contrato]}`
                : ""}
              {!contrato && processo.nm_comprador_convidado
                ? ` — ${processo.nm_comprador_convidado}`
                : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {podeEditar && (
              <Link
                href={`${base}/editar`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar dados
              </Link>
            )}
            {podeExcluir && (
              <ExcluirProcessoButton cdProcesso={id} numeroProcesso={processo.ds_numero_processo} />
            )}
          </div>
        </div>

        {contrato && (
          <>
            <EtapasProgresso etapa={processo.tp_etapa_contrato} />
            <dl className="grid grid-cols-1 gap-2 rounded-radius border border-border bg-card p-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Vendedor(es)</dt>
                <dd className="text-foreground">{nomes(vendedores)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Comprador(es)</dt>
                <dd className="text-foreground">{nomes(compradores)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Valor do imóvel</dt>
                <dd className="text-foreground">
                  {negocio?.vl_imovel != null ? formatarMoeda(Number(negocio.vl_imovel)) : "—"}
                </dd>
              </div>
            </dl>
          </>
        )}
      </header>

      <ProcessoAbas abas={abas} />

      {children}
    </FadeIn>
  );
}
