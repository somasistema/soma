import { tipoDocumentoFiscal } from "@/lib/documento-fiscal";
import type { createServiceRoleClient } from "@/lib/supabase/server";
import type { Minuta, Processo } from "@/types/database";
import type { SignatarioEntrada } from "./tipos";

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

type Pessoa = { nome: string; email: string; cd_usuario: string | null };

async function usuario(supabase: ServiceClient, cdUsuario: string | null) {
  if (!cdUsuario) return null;
  const { data } = await supabase
    .schema("soma")
    .from("usuarios")
    .select("cd_usuario, nm_usuario, ds_email, tp_role, sn_ativo")
    .eq("cd_usuario", cdUsuario)
    .maybeSingle();
  return data ?? null;
}

function exigirEmail(
  papel: string,
  u: { cd_usuario?: string | null; nm_usuario: string; ds_email: string | null } | null,
  contexto: string
): Pessoa {
  if (!u || !u.ds_email) {
    throw new Error(`Não foi possível definir o signatário "${papel}": ${contexto}`);
  }
  return { nome: u.nm_usuario, email: u.ds_email, cd_usuario: u.cd_usuario ?? null };
}

// Pessoas físicas de um lado (vendedor/comprador) do cadastro do processo.
// Se a primeira parte do lado é empresa (CNPJ), ela não assina — assinam as
// pessoas ligadas a ela (representantes e sócios anuentes). Quem não tem
// e-mail cadastrado barra o envio, dizendo quem é.
async function pessoasDoLado(
  supabase: ServiceClient,
  cdProcesso: string,
  lado: "vendedor" | "comprador"
): Promise<Pessoa[]> {
  const { data } = await supabase
    .schema("soma")
    .from("processo_parte")
    .select("nm_parte, ds_email, ds_cpf, nr_ordem")
    .eq("cd_processo", cdProcesso)
    .eq("tp_lado", lado)
    .order("nr_ordem");

  const partes = data ?? [];
  const pessoas = partes.filter(
    (p, i) => !(i === 0 && tipoDocumentoFiscal(p.ds_cpf ?? "") === "cnpj")
  );

  return pessoas.map((p) => {
    const email = p.ds_email?.trim();
    if (!email) {
      throw new Error(
        `Não foi possível definir o signatário "${lado}": ${p.nm_parte} está sem e-mail (preencha em Editar dados).`
      );
    }
    return { nome: p.nm_parte.trim(), email, cd_usuario: null };
  });
}

async function corretoresDoProcesso(
  supabase: ServiceClient,
  processo: Processo
): Promise<Pessoa[]> {
  const { data: linhas } = await supabase
    .schema("soma")
    .from("processo_corretor")
    .select("nm_corretor, cd_corretor")
    .eq("cd_processo", processo.cd_processo)
    .order("nr_ordem");

  if (!linhas || linhas.length === 0) {
    // Processo antigo, sem cadastro de corretor: usa a conta do usuário.
    const conta = await usuario(supabase, processo.cd_corretor);
    return [exigirEmail("corretor", conta, "nenhum corretor informado no processo.")];
  }

  const ids = linhas.map((l) => l.cd_corretor).filter(Boolean) as string[];
  const { data: cadastro } = ids.length
    ? await supabase
        .schema("soma")
        .from("corretores")
        .select("cd_corretor, ds_email")
        .in("cd_corretor", ids)
    : { data: [] };
  const emails = new Map((cadastro ?? []).map((c) => [c.cd_corretor, c.ds_email?.trim()]));

  return linhas.map((l) => {
    const email = l.cd_corretor ? emails.get(l.cd_corretor) : null;
    if (!email) {
      throw new Error(
        `Não foi possível definir o signatário "corretor": ${l.nm_corretor} está sem e-mail (preencha em Editar dados).`
      );
    }
    return { nome: l.nm_corretor.trim(), email, cd_usuario: null };
  });
}

// Cada e-mail identifica uma pessoa: a mesma pessoa em dois papéis vira uma
// só; duas pessoas diferentes com o mesmo e-mail travam o envio (senão uma
// delas nunca receberia/assinaria).
function unicosPorEmail(todos: SignatarioEntrada[]): SignatarioEntrada[] {
  const porEmail = new Map<string, SignatarioEntrada>();
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  for (const s of todos) {
    const chave = s.email.trim().toLowerCase();
    const existente = porEmail.get(chave);
    if (!existente) {
      porEmail.set(chave, s);
    } else if (norm(existente.nome) !== norm(s.nome)) {
      throw new Error(
        `O e-mail ${s.email} está em duas pessoas (${existente.nome} e ${s.nome}). Cada pessoa precisa de um e-mail próprio.`
      );
    }
  }
  return [...porEmail.values()];
}

// Pra receber a minuta, cada pessoa tem o próprio link: duas pessoas podem dividir
// o mesmo e-mail (casal, por exemplo) e cada uma recebe o seu. Só a mesma pessoa
// (mesmo nome e e-mail) em dois papéis é contada uma vez.
function unicosPorPessoa(todos: SignatarioEntrada[]): SignatarioEntrada[] {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  const vistos = new Map<string, SignatarioEntrada>();
  for (const s of todos) {
    const chave = `${norm(s.email)}|${norm(s.nome)}`;
    if (!vistos.has(chave)) vistos.set(chave, s);
  }
  return [...vistos.values()];
}

// Corretor(es), comprador(es), vendedor(es) e imobiliária do processo — as
// frentes de fora da equipe. Quem assina o contrato e quem recebe a minuta
// pra aprovar são essas pessoas. Lança um erro claro se alguém não puder ser
// resolvido (ex: sem e-mail) — melhor barrar do que mandar incompleto.
async function pessoasDasFrentes(
  supabase: ServiceClient,
  processo: Processo
): Promise<SignatarioEntrada[]> {
  const [corretores, compradores, vendedores] = await Promise.all([
    corretoresDoProcesso(supabase, processo),
    pessoasDoLado(supabase, processo.cd_processo, "comprador"),
    pessoasDoLado(supabase, processo.cd_processo, "vendedor"),
  ]);

  if (compradores.length === 0) {
    throw new Error('Não foi possível definir o signatário "comprador": nenhum comprador cadastrado.');
  }
  if (vendedores.length === 0) {
    throw new Error('Não foi possível definir o signatário "vendedor": nenhum vendedor cadastrado.');
  }

  // Imobiliária — representante com conta; senão o e-mail do cadastro dela.
  // Processo sem imobiliária não tem assinatura dessa frente.
  let imobiliaria: Pessoa | null = null;
  if (processo.cd_imobiliaria) {
    const { data } = await supabase
      .schema("soma")
      .from("usuarios")
      .select("cd_usuario, nm_usuario, ds_email")
      .eq("cd_imobiliaria", processo.cd_imobiliaria)
      .eq("tp_role", "imobiliaria")
      .eq("sn_ativo", true)
      .order("ts_criacao", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data?.ds_email) {
      imobiliaria = { nome: data.nm_usuario, email: data.ds_email, cd_usuario: data.cd_usuario };
    } else {
      const { data: imob } = await supabase
        .schema("soma")
        .from("imobiliarias")
        .select("nm_imobiliaria, ds_email")
        .eq("cd_imobiliaria", processo.cd_imobiliaria)
        .maybeSingle();
      imobiliaria = exigirEmail(
        "imobiliaria",
        imob?.ds_email ? { nm_usuario: imob.nm_imobiliaria, ds_email: imob.ds_email } : null,
        `a imobiliária${imob?.nm_imobiliaria ? ` ${imob.nm_imobiliaria}` : ""} está sem e-mail (cadastre em Configurações › Imobiliárias).`
      );
    }
  }

  return [
    ...corretores.map((p) => ({ tp_papel: "corretor" as const, ...p })),
    ...compradores.map((p) => ({ tp_papel: "comprador" as const, ...p })),
    ...vendedores.map((p) => ({ tp_papel: "vendedor" as const, ...p })),
    ...(imobiliaria ? [{ tp_papel: "imobiliaria" as const, ...imobiliaria }] : []),
  ];
}

// Quem recebe a minuta por e-mail pra aprovar: as frentes de fora da equipe
// (o Jurídico decide dentro do sistema).
export async function resolverDestinatariosMinuta(
  supabase: ServiceClient,
  processo: Processo
): Promise<SignatarioEntrada[]> {
  return unicosPorPessoa(await pessoasDasFrentes(supabase, processo));
}

// Monta quem vai assinar o contrato: as frentes do processo + o jurídico.
export async function resolverSignatarios(
  supabase: ServiceClient,
  processo: Processo,
  minuta: Pick<Minuta, "cd_criador">
): Promise<SignatarioEntrada[]> {
  const frentes = await pessoasDasFrentes(supabase, processo);

  // Jurídico — quem enviou a minuta; se não der, primeiro jurídico ativo.
  let juridico = await usuario(supabase, minuta.cd_criador);
  if (!juridico || !juridico.ds_email) {
    const { data } = await supabase
      .schema("soma")
      .from("usuarios")
      .select("cd_usuario, nm_usuario, ds_email")
      .eq("tp_role", "juridico")
      .eq("sn_ativo", true)
      .order("ts_criacao", { ascending: true })
      .limit(1)
      .maybeSingle();
    juridico = data ? { ...data, tp_role: "juridico", sn_ativo: true } : juridico;
  }

  return unicosPorEmail([
    ...frentes,
    {
      tp_papel: "juridico" as const,
      ...exigirEmail("juridico", juridico, "nenhum usuário do Jurídico disponível."),
    },
  ]);
}
