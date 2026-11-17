"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  CONSULTA_PAGA_INFO,
  consultasDaPessoa,
  type ConsultaPaga,
  type ResultadoConsultaPaga,
  type TipoConsultaPaga,
} from "@/lib/consultas-pagas";
import { documentoFiscalValido } from "@/lib/documento-fiscal";
import { formatarData, formatarMoeda } from "@/lib/utils";
import { consultarParte } from "./consultas-actions";

const SELO: Record<ResultadoConsultaPaga, { texto: string; classe: string }> = {
  negativa: { texto: "Nada consta", classe: "bg-status-aceito/15 text-status-aceito" },
  com_efeitos: { texto: "Positiva com efeitos de negativa", classe: "bg-status-pendente/15 text-status-pendente" },
  positiva: { texto: "Constam débitos", classe: "bg-status-reprovado/15 text-status-reprovado" },
  desconhecido: { texto: "Conferir", classe: "bg-muted-foreground/15 text-muted-foreground" },
};

// Certidão com validade ainda em dia (consulta de teste nunca conta).
function aindaValida(c: ConsultaPaga): boolean {
  if (c.sn_homologacao) return false;
  if (!c.dt_validade) return CONSULTA_PAGA_INFO[c.tp_consulta].comValidade === false;
  return c.dt_validade >= new Date().toISOString().slice(0, 10);
}

export function LinhaConsulta({
  cdProcesso,
  cdParte,
  tipo,
  ultima,
  titulo,
  automatica = false,
}: {
  cdProcesso: string;
  cdParte: string;
  tipo: TipoConsultaPaga;
  ultima: ConsultaPaga | undefined;
  titulo?: string;
  // Consulta sozinha ao abrir a tela, uma vez, se ainda não existe resultado.
  automatica?: boolean;
}) {
  const info = CONSULTA_PAGA_INFO[tipo];
  const [pendente, startConsulta] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const jaTentou = useRef(false);
  useEffect(() => {
    if (!automatica || ultima || jaTentou.current) return;
    jaTentou.current = true;
    startConsulta(async () => {
      const r = await consultarParte(cdProcesso, cdParte, tipo, true);
      if (!r.ok) setErro(r.erro);
      else if (r.pendenciaCriada) setAviso("Resultado com débito: abri uma pendência no processo.");
    });
  }, [automatica, ultima, cdProcesso, cdParte, tipo]);

  function consultar() {
    const preco = formatarMoeda(info.custo);
    const aviso =
      ultima && aindaValida(ultima)
        ? `Já existe esta consulta, feita em ${formatarData(ultima.ts_criacao)}${ultima.dt_validade ? ` e válida até ${formatarData(ultima.dt_validade)}` : ""}.\n\nConsultar de novo cobra ${preco} do saldo. Continuar?`
        : `${info.rotulo}: esta consulta cobra ${preco} do saldo. Continuar?`;
    if (!window.confirm(aviso)) return;
    setErro(null);
    setAviso(null);
    startConsulta(async () => {
      const r = await consultarParte(cdProcesso, cdParte, tipo);
      if (!r.ok) setErro(r.erro);
      else if (r.pendenciaCriada) setAviso("Resultado com débito ou protesto: abri uma pendência no processo.");
    });
  }

  const selo = ultima ? SELO[ultima.tp_resultado] : null;

  return (
    <div className="flex flex-col gap-1 border-t border-border py-2 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-foreground">{titulo ?? info.rotulo}</p>
          <p className="text-xs text-muted-foreground">{info.descricao}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          disabled={pendente}
          onClick={consultar}
        >
          <Search className="h-3.5 w-3.5" />
          {pendente ? "Consultando..." : ultima ? "Consultar de novo" : "Consultar"}
        </Button>
      </div>

      {ultima && selo && (
        <div className="flex flex-col gap-1 rounded-radius bg-muted/40 px-2 py-1.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 font-medium ${selo.classe}`}>{selo.texto}</span>
            {ultima.sn_homologacao && (
              <span className="rounded-full bg-status-pendente/15 px-2 py-0.5 font-medium text-status-pendente">
                TESTE: dados fictícios
              </span>
            )}
            <span className="text-muted-foreground">
              consultado em {formatarData(ultima.ts_criacao)}
              {ultima.dt_validade ? ` · válida até ${formatarData(ultima.dt_validade)}` : ""}
              {ultima.dt_validade && !aindaValida(ultima) && !ultima.sn_homologacao ? " (vencida)" : ""}
            </span>
          </div>
          {ultima.ds_resumo && <p className="text-foreground">{ultima.ds_resumo}</p>}
          {ultima.detalhe && !ultima.ds_resumo?.includes(ultima.detalhe) && (
            <p className="max-h-32 overflow-y-auto whitespace-pre-line text-muted-foreground">{ultima.detalhe}</p>
          )}
          {ultima.comprovante?.startsWith("https://") && (
            <a href={ultima.comprovante} target="_blank" rel="noopener noreferrer" className="w-fit text-primary underline">
              Ver comprovante da consulta
            </a>
          )}
        </div>
      )}

      {aviso && (
        <p role="status" className="text-xs text-status-pendente">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="text-xs text-status-reprovado">
          {erro}
        </p>
      )}
    </div>
  );
}

// Consultas pagas de uma parte: certidão federal, estadual e protesto (pessoa física); só a federal
// para empresa. Mostra o último resultado de cada uma e pede confirmação antes de cobrar.
export function ConsultasParte({
  cdProcesso,
  cdParte,
  pessoaJuridica,
  documentoValido,
  consultas,
}: {
  cdProcesso: string;
  cdParte: string;
  pessoaJuridica: boolean;
  documentoValido: boolean;
  consultas: ConsultaPaga[];
}) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Consultas (certidões e protesto)</p>
      {!documentoValido ? (
        <p className="text-xs text-muted-foreground">
          Informe um {pessoaJuridica ? "CNPJ" : "CPF"} válido para liberar as consultas.
        </p>
      ) : (
        <div className="flex flex-col">
          {consultasDaPessoa(pessoaJuridica).map((tipo) => (
            <LinhaConsulta
              key={tipo}
              cdProcesso={cdProcesso}
              cdParte={cdParte}
              tipo={tipo}
              // As consultas chegam da mais nova para a mais antiga.
              ultima={consultas.find((c) => c.tp_consulta === tipo)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Certidão negativa municipal do imóvel: consulta pelo CPF/CNPJ de cada vendedor (quem consta como dono).
export function ConsultasImovel({
  cdProcesso,
  vendedores,
  consultas,
}: {
  cdProcesso: string;
  vendedores: { cd_parte: string; nm_parte: string; ds_cpf: string | null }[];
  consultas: ConsultaPaga[];
}) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Consultas do imóvel (certidão municipal)</p>
      {vendedores.length === 0 ? (
        <p className="text-xs text-muted-foreground">Cadastre o vendedor na aba Partes para consultar.</p>
      ) : (
        <div className="flex flex-col">
          {vendedores.map((v) =>
            documentoFiscalValido(v.ds_cpf ?? "") ? (
              <LinhaConsulta
                key={v.cd_parte}
                cdProcesso={cdProcesso}
                cdParte={v.cd_parte}
                tipo="cnd_municipal"
                automatica
                titulo={`${CONSULTA_PAGA_INFO.cnd_municipal.rotulo} — ${v.nm_parte}`}
                ultima={consultas.find((c) => c.tp_consulta === "cnd_municipal" && c.cd_parte === v.cd_parte)}
              />
            ) : (
              <p key={v.cd_parte} className="border-t border-border py-2 text-xs text-muted-foreground first:border-t-0">
                {v.nm_parte}: informe um CPF ou CNPJ válido na aba Partes para liberar a consulta.
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
