import type { createServiceRoleClient } from "@/lib/supabase/server";

// O que a leitura de um documento completou na própria pessoa (a tela do
// cliente mostra na hora, sem redigitar).
export type DadosPreenchidos = Partial<{
  nm_parte: string;
  ds_cpf: string;
  ds_rg: string;
  dt_nascimento: string;
  ds_endereco: string;
}>;

const MARCA_NOME_PROVISORIO = "aguardando preenchimento";

// dd/mm/aaaa -> aaaa-mm-dd
function dataIso(valor: string | undefined) {
  const m = valor?.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

type CampoLidoSimples = { nm_campo: string; ds_valor: string };
type DadosAtuais = {
  nm_parte: string | null;
  ds_cpf: string | null;
  ds_rg: string | null;
  dt_nascimento: string | null;
  ds_endereco: string | null;
};

// O que a leitura do documento completa: só o que ainda está vazio.
export function montarPatch(
  categoria: string,
  campos: CampoLidoSimples[],
  atual: DadosAtuais
): DadosPreenchidos {
  const get = (nome: string) => campos.find((c) => c.nm_campo === nome)?.ds_valor?.trim();
  const patch: DadosPreenchidos = {};

  if (categoria === "identidade") {
    const nome = get("nome");
    if (nome && (!atual.nm_parte || atual.nm_parte.includes(MARCA_NOME_PROVISORIO))) {
      patch.nm_parte = nome;
    }
    if (!atual.ds_cpf && get("cpf")) patch.ds_cpf = get("cpf");
    if (!atual.ds_rg && get("rg")) patch.ds_rg = get("rg");
    const nasc = dataIso(get("data_nascimento"));
    if (!atual.dt_nascimento && nasc) patch.dt_nascimento = nasc;
  }
  if (categoria === "comprovante_residencia") {
    if (!atual.ds_endereco && get("endereco")) patch.ds_endereco = get("endereco");
  }
  return patch;
}

// Completa, na própria pessoa, só o que ainda está vazio a partir do que a
// leitura achou no documento recém-enviado. Nunca sobrescreve dado digitado.
export async function preencherParteComLeitura(
  service: ReturnType<typeof createServiceRoleClient>,
  cdParte: string,
  cdDocumento: string,
  categoria: string
): Promise<DadosPreenchidos> {
  if (categoria !== "identidade" && categoria !== "comprovante_residencia") return {};

  const { data: ocr } = await service
    .schema("soma")
    .from("documento_ocr")
    .select("cd_documento_ocr")
    .eq("cd_documento", cdDocumento)
    .maybeSingle();
  if (!ocr) return {};

  const [{ data: campos }, { data: parte }] = await Promise.all([
    service
      .schema("soma")
      .from("documento_ocr_campos")
      .select("nm_campo, ds_valor")
      .eq("cd_documento_ocr", ocr.cd_documento_ocr),
    service
      .schema("soma")
      .from("processo_parte")
      .select("nm_parte, ds_cpf, ds_rg, dt_nascimento, ds_endereco")
      .eq("cd_parte", cdParte)
      .maybeSingle(),
  ]);
  if (!parte) return {};

  const patch = montarPatch(categoria, campos ?? [], parte);

  if (Object.keys(patch).length > 0) {
    await service.schema("soma").from("processo_parte").update(patch).eq("cd_parte", cdParte);
  }
  return patch;
}
