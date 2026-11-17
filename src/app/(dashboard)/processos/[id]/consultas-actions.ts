"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioAtual } from "@/lib/auth";
import { consultarApiBrasil } from "@/lib/apibrasil";
import { consultarCndSalvador } from "@/lib/infosimples";
import {
  CONSULTA_PAGA_INFO,
  CONSULTAS_DO_IMOVEL,
  consultasDaPessoa,
  UF_CERTIDAO_ESTADUAL,
  type ConsultaPaga,
  type ResultadoAcaoConsulta,
  type TipoConsultaPaga,
} from "@/lib/consultas-pagas";
import { documentoFiscalValido, tipoDocumentoFiscal } from "@/lib/documento-fiscal";
import { createServiceRoleClient } from "@/lib/supabase/server";

// Consultas pagas por parte (certidão federal, estadual e protesto). Só Master e Jurídico: cada uma
// gasta saldo. O resultado fica guardado (consultas_externas) para ninguém pagar duas vezes.

const PODE = new Set(["master", "juridico"]);

export async function consultarParte(
  cdProcesso: string,
  cdParte: string,
  tipo: TipoConsultaPaga,
  automatica = false
): Promise<ResultadoAcaoConsulta> {
  const usuario = await getUsuarioAtual();
  if (!PODE.has(usuario.tp_role)) return { ok: false, erro: "Só Master ou Jurídico faz consultas pagas." };
  if (!(tipo in CONSULTA_PAGA_INFO)) return { ok: false, erro: "Consulta desconhecida." };

  const service = createServiceRoleClient();
  const { data: parte } = await service
    .schema("soma")
    .from("processo_parte")
    .select("cd_parte, nm_parte, ds_cpf, tp_lado")
    .eq("cd_parte", cdParte)
    .eq("cd_processo", cdProcesso)
    .maybeSingle();
  if (!parte) return { ok: false, erro: "Parte não encontrada neste processo." };

  const documento = (parte.ds_cpf ?? "").replace(/\D/g, "");
  if (!documento || !documentoFiscalValido(documento)) {
    return { ok: false, erro: "Esta parte não tem CPF ou CNPJ válido cadastrado. Complete o cadastro antes de consultar." };
  }
  const pessoaJuridica = tipoDocumentoFiscal(documento) === "cnpj";
  const doImovel = CONSULTAS_DO_IMOVEL.includes(tipo);
  if (doImovel ? parte.tp_lado !== "vendedor" : !consultasDaPessoa(pessoaJuridica).includes(tipo)) {
    return { ok: false, erro: doImovel ? "Esta consulta é feita no documento do vendedor." : "Esta consulta não existe para esse tipo de pessoa." };
  }

  // Confere que o histórico existe ANTES de pagar: sem a tabela o resultado seria perdido.
  const { error: erroTabela } = await service.schema("soma").from("consultas_externas").select("cd_consulta").limit(1);
  if (erroTabela) {
    console.error("[consultas] tabela consultas_externas indisponível:", erroTabela.message);
    return { ok: false, erro: "O histórico de consultas ainda não foi criado no banco (migration 082). Nada foi cobrado." };
  }

  const fornecedor = doImovel ? "infosimples" : "apibrasil";
  // Consulta automática nunca repete: se já existe uma para esta parte (de qualquer data), devolve a existente.
  if (automatica) {
    const { data: existente } = await service
      .schema("soma")
      .from("consultas_externas")
      .select("cd_consulta, cd_parte, tp_consulta, ds_documento, ds_uf, tp_resultado, ds_resumo, dt_validade, vl_custo, sn_homologacao, ts_criacao")
      .eq("cd_processo", cdProcesso)
      .eq("cd_parte", cdParte)
      .eq("tp_consulta", tipo)
      .order("ts_criacao", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existente) {
      return { ok: true, consulta: { ...existente, vl_custo: Number(existente.vl_custo) } as ConsultaPaga, pendenciaCriada: false };
    }
  }

  const r = doImovel
    ? await consultarCndSalvador(documento, pessoaJuridica)
    : await consultarApiBrasil(tipo, documento, { pessoaJuridica, uf: UF_CERTIDAO_ESTADUAL });
  if (!r.ok) return r;
  const c = r.consulta;

  const { data: linha, error } = await service
    .schema("soma")
    .from("consultas_externas")
    .insert({
      cd_processo: cdProcesso,
      cd_parte: cdParte,
      tp_consulta: tipo,
      ds_fornecedor: fornecedor,
      ds_documento: documento,
      ds_uf: tipo === "certidao_estadual" ? UF_CERTIDAO_ESTADUAL : null,
      tp_resultado: c.resultado,
      ds_resumo: c.resumo,
      dt_validade: c.validade,
      js_dados: c.dados,
      vl_custo: c.custo ?? CONSULTA_PAGA_INFO[tipo].custo,
      sn_homologacao: c.homologacao,
      cd_usuario: usuario.cd_usuario,
    })
    .select("cd_consulta, cd_parte, tp_consulta, ds_documento, ds_uf, tp_resultado, ds_resumo, dt_validade, vl_custo, sn_homologacao, ts_criacao")
    .single();
  if (error || !linha) {
    // A consulta já foi paga: registra o resumo no log para não se perder.
    console.error("[consultas] consulta paga e não gravada:", error?.message, { cdProcesso, cdParte, tipo, resultado: c.resultado, resumo: c.resumo });
    return { ok: false, erro: "A consulta foi feita, mas não consegui gravar o resultado. Avise o administrador antes de repetir." };
  }

  // Débito ou protesto vira pendência aberta no processo (uma só por parte e consulta, enquanto aberta).
  // Consulta de teste (homologação) nunca abre pendência.
  let pendenciaCriada = false;
  if (!c.homologacao && (c.resultado === "positiva" || c.resultado === "com_efeitos")) {
    const texto = `${CONSULTA_PAGA_INFO[tipo].rotulo} de ${parte.nm_parte}: ${c.resumo} Conferir antes de seguir com o contrato.`;
    const { data: jaAberta } = await service
      .schema("soma")
      .from("pendencias")
      .select("cd_pendencia")
      .eq("cd_processo", cdProcesso)
      .eq("tp_status", "aberta")
      .eq("ds_pendencia", texto)
      .limit(1)
      .maybeSingle();
    if (!jaAberta) {
      const { error: erroPend } = await service
        .schema("soma")
        .from("pendencias")
        .insert({ cd_processo: cdProcesso, cd_responsavel: usuario.cd_usuario, ds_pendencia: texto });
      if (erroPend) console.error("[consultas] pendência não criada:", erroPend.message);
      else pendenciaCriada = true;
    }
  }

  revalidatePath(`/processos/${cdProcesso}`);
  revalidatePath(`/processos/${cdProcesso}/partes`);
  revalidatePath(`/processos/${cdProcesso}/imovel`);
  return { ok: true, consulta: { ...linha, vl_custo: Number(linha.vl_custo) } as ConsultaPaga, pendenciaCriada };
}
