import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatarMoeda, formatarPercentual } from "@/lib/utils";
import {
  CATEGORIA_DOC_INTAKE_LABEL,
  CATEGORIAS_DOC_IMOVEL,
} from "@/types/database";
import { DocumentoAnexarButton } from "./documento-anexar-button";
import {
  carregarDadosNegocio,
  ItemDocumento,
  Linha,
  moeda,
  simNao,
  valorComPercentual,
} from "./dados-negocio-comum";

export async function ImovelSection({ cdProcesso }: { cdProcesso: string }) {
  const { negocio, corretores, docsImovel, cartorio } = await carregarDadosNegocio(cdProcesso);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Imóvel e valores</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Imóvel</p>
          <div className="rounded-radius border border-border p-3">
            {negocio && (
              <>
                <Linha rotulo="Endereço" valor={negocio.ds_imovel_endereco} />
                <Linha rotulo="Descrição" valor={negocio.ds_imovel_descricao} />
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

        {(negocio || corretores.length > 0) && (
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
              {corretores.map((c) => (
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
