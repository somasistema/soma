import { resolverDestinatariosMinuta } from "@/lib/assinatura/signatarios";
import { getSiteUrl } from "@/lib/mercadopago";
import { enviarEmail } from "@/lib/resend";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { PAPEL_APROVACAO_LABEL, type Minuta, type Processo } from "@/types/database";

export type ResultadoConvites = {
  enviados: number;
  jaResponderam: number;
  // Já tinham recebido o e-mail e não foram incomodados de novo.
  jaRecebiam: number;
  falhas: string[];
  erro?: string;
};

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function emailDaMinuta(params: { nome: string; papel: string; numero: string; link: string }) {
  const nome = escapar(params.nome);
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#18181b">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px">
    <p style="margin:0 0 16px;font-size:16px">Olá, ${nome}.</p>
    <p style="margin:0 0 16px;font-size:15px;line-height:1.5">
      A minuta do contrato do processo <strong>${escapar(params.numero)}</strong> está pronta
      para a sua conferência (${escapar(params.papel)}).
    </p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.5">
      Abra o link abaixo, leia o PDF e escolha <strong>aceitar</strong> ou <strong>recusar</strong>.
      Se recusar, conte o motivo para a gente ajustar.
    </p>
    <p style="margin:0 0 24px">
      <a href="${params.link}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px">Ler a minuta e responder</a>
    </p>
    <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5">
      Este link é só seu. Se o botão não abrir, copie o endereço: ${params.link}
    </p>
  </div></body></html>`;
}

// Manda por e-mail o link de aprovação da minuta pra cada pessoa das frentes
// de fora da equipe (corretor, comprador, vendedor, imobiliária). Quem já
// respondeu não recebe de novo; quem ainda não respondeu recebe o mesmo link
// outra vez (serve como reenvio). Roda com service_role — quem chama já
// checou o perfil.
export async function enviarConvitesMinuta(cdMinuta: string): Promise<ResultadoConvites> {
  const vazio: ResultadoConvites = { enviados: 0, jaResponderam: 0, jaRecebiam: 0, falhas: [] };

  const site = getSiteUrl();
  if (!site) {
    return { ...vazio, erro: "NEXT_PUBLIC_SITE_URL não está configurada: não dá pra montar o link do e-mail." };
  }

  const supabase = createServiceRoleClient();

  const { data: minuta } = await supabase
    .schema("soma")
    .from("minutas")
    .select("*")
    .eq("cd_minuta", cdMinuta)
    .maybeSingle<Minuta>();
  if (!minuta) return { ...vazio, erro: "Minuta não encontrada." };

  const [{ data: processo }, { data: ultima }, { data: contrato }] = await Promise.all([
    supabase
      .schema("soma")
      .from("processos")
      .select("*")
      .eq("cd_processo", minuta.cd_processo)
      .maybeSingle<Processo>(),
    supabase
      .schema("soma")
      .from("minutas")
      .select("nr_versao")
      .eq("cd_processo", minuta.cd_processo)
      .order("nr_versao", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.schema("soma").from("contratos").select("cd_contrato").eq("cd_minuta", cdMinuta).maybeSingle(),
  ]);
  if (!processo) return { ...vazio, erro: "Processo não encontrado." };
  if (contrato) return { ...vazio, erro: "A minuta já virou contrato final." };
  if (ultima && ultima.nr_versao !== minuta.nr_versao) {
    return { ...vazio, erro: "Esta não é a versão mais recente da minuta." };
  }
  if (minuta.tp_status !== "em_aprovacao") {
    return { ...vazio, erro: "A minuta não está em aprovação (foi reprovada ou já aprovada)." };
  }

  let destinatarios;
  try {
    destinatarios = await resolverDestinatariosMinuta(supabase, processo);
  } catch (e) {
    return { ...vazio, erro: e instanceof Error ? e.message : String(e) };
  }

  const { data: existentes } = await supabase
    .schema("soma")
    .from("minuta_convites")
    .select("cd_convite, nm_destinatario, ds_email, tp_status, ts_envio")
    .eq("cd_minuta", cdMinuta);
  // Um convite por pessoa (nome + e-mail): quem divide o e-mail com outra pessoa
  // recebe o próprio link.
  const chavePessoa = (nome: string, email: string) =>
    `${email.trim().toLowerCase()}|${nome.trim().toLowerCase().replace(/\s+/g, " ")}`;
  const porEmail = new Map(
    (existentes ?? []).map((c) => [chavePessoa(c.nm_destinatario, c.ds_email), c])
  );

  // Se alguém ainda não recebeu (convite novo ou e-mail que falhou antes), só
  // essas pessoas recebem agora — quem já recebeu não é incomodado de novo. Só
  // quando todos já receberam é que o botão reenvia pra quem não respondeu.
  const soFaltantes = destinatarios.some((d) => {
    const c = porEmail.get(chavePessoa(d.nome, d.email));
    return !c || (c.tp_status === "pendente" && !c.ts_envio);
  });

  const resultado = { ...vazio };
  const nomesEnviados: string[] = [];

  for (const d of destinatarios) {
    let convite = porEmail.get(chavePessoa(d.nome, d.email));

    if (convite && convite.tp_status !== "pendente") {
      resultado.jaResponderam++;
      continue;
    }
    if (soFaltantes && convite?.ts_envio) {
      resultado.jaRecebiam++;
      continue;
    }

    if (!convite) {
      const { data: novo, error } = await supabase
        .schema("soma")
        .from("minuta_convites")
        .insert({
          cd_minuta: cdMinuta,
          tp_papel: d.tp_papel,
          nm_destinatario: d.nome,
          ds_email: d.email,
        })
        .select("cd_convite, nm_destinatario, ds_email, tp_status, ts_envio")
        .single();
      if (error || !novo) {
        resultado.falhas.push(`${d.nome}: ${error?.message ?? "não foi possível criar o convite"}`);
        continue;
      }
      convite = novo;
    }

    const { erro } = await enviarEmail({
      to: d.email,
      subject: `Minuta do contrato ${processo.ds_numero_processo} — leia e responda`,
      html: emailDaMinuta({
        nome: d.nome,
        papel: PAPEL_APROVACAO_LABEL[d.tp_papel],
        numero: processo.ds_numero_processo,
        link: `${site.replace(/\/$/, "")}/aprovar/${convite.cd_convite}`,
      }),
    });

    if (erro) {
      resultado.falhas.push(`${d.nome} (${d.email}): ${erro}`);
    } else {
      resultado.enviados++;
      nomesEnviados.push(d.nome);
      await supabase
        .schema("soma")
        .from("minuta_convites")
        .update({ ts_envio: new Date().toISOString() })
        .eq("cd_convite", convite.cd_convite);
    }

    // O Resend limita a 2 envios por segundo.
    await esperar(600);
  }

  if (nomesEnviados.length > 0) {
    await supabase.schema("soma").rpc("fn_registrar_andamento", {
      p_cd_processo: processo.cd_processo,
      p_nm_etapa: "Minuta enviada por e-mail",
      p_ds_andamento: `Minuta (versão ${minuta.nr_versao}) enviada por e-mail para aprovação de: ${nomesEnviados.join(", ")}.`,
    });
  }

  return resultado;
}
