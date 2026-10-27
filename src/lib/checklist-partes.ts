import type { CategoriaDocIntake, LadoParte, VinculoParte } from "@/types/database";

type ParteBase = {
  cd_parte: string;
  nm_parte: string;
  tp_lado: LadoParte;
  nr_ordem: number;
  tp_vinculo: VinculoParte | null;
};

// Só cônjuge e companheiro(a) formam par (documentos compartilhados);
// anuente e "outra pessoa" mandam os próprios documentos.
const FORMA_PAR: string[] = ["conjuge", "companheiro"];

export type ParDaParte<P extends ParteBase> = {
  parceiro: P;
  vinculo: "conjuge" | "companheiro";
} | null;

// Mesma regra de soma.fn_par_da_parte (migration 057): o par de uma
// pessoa é a anterior do mesmo lado, se ESTA tem vínculo de cônjuge/
// companheiro(a); senão a próxima, se a próxima tem esse vínculo com
// esta. Sem vínculo informado na 2ª pessoa em diante = cônjuge.
export function parDaParte<P extends ParteBase>(parte: P, todas: P[]): ParDaParte<P> {
  if (parte.tp_lado !== "vendedor" && parte.tp_lado !== "comprador") return null;

  const lado = todas
    .filter((p) => p.tp_lado === parte.tp_lado)
    .sort((a, b) => a.nr_ordem - b.nr_ordem || a.nm_parte.localeCompare(b.nm_parte));
  const i = lado.findIndex((p) => p.cd_parte === parte.cd_parte);
  const vinculo = (p: P) => p.tp_vinculo ?? "conjuge";

  if (i > 0 && FORMA_PAR.includes(vinculo(lado[i]))) {
    return { parceiro: lado[i - 1], vinculo: vinculo(lado[i]) as "conjuge" | "companheiro" };
  }
  const proxima = lado[i + 1];
  if (proxima && FORMA_PAR.includes(vinculo(proxima))) {
    return { parceiro: proxima, vinculo: vinculo(proxima) as "conjuge" | "companheiro" };
  }
  return null;
}

export type ItemChecklist = { categoria: CategoriaDocIntake; compartilhado: boolean };

// Casados: certidão de casamento e comprovante de endereço valem pros
// dois. União estável: cada um manda o próprio estado civil, o
// comprovante de endereço é um só, e a declaração de união estável
// também (uma pro casal).
export function checklistDaPessoa(
  vinculo: "conjuge" | "companheiro" | null,
  empresa = false
): ItemChecklist[] {
  // Empresa (CNPJ): contrato social/JUCEB e certidões — não tem identidade nem estado civil.
  if (empresa) {
    return [
      { categoria: "contrato_social", compartilhado: false },
      { categoria: "certidoes", compartilhado: false },
    ];
  }
  return [
    { categoria: "identidade", compartilhado: false },
    { categoria: "estado_civil", compartilhado: vinculo === "conjuge" },
    { categoria: "comprovante_residencia", compartilhado: vinculo !== null },
    ...(vinculo === "companheiro"
      ? [{ categoria: "uniao_estavel" as const, compartilhado: true }]
      : []),
  ];
}

// "1990-02-03" -> "03/02/1990" (sem passar por Date, que muda o dia
// conforme o fuso).
export function formatarDataIso(data: string | null | undefined) {
  if (!data) return null;
  const [a, m, d] = data.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : data;
}
