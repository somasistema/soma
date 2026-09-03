import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { formatarMoeda } from "@/lib/utils";
import {
  STATUS_DOC_INTAKE_LABEL,
  type ProcessoCorretor,
  type ProcessoNegocio,
  type ProcessoParte,
  type StatusDocIntake,
} from "@/types/database";

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

function docLabel(v: StatusDocIntake | null) {
  return v ? STATUS_DOC_INTAKE_LABEL[v] : null;
}

function ParteCard({ parte }: { parte: ProcessoParte }) {
  return (
    <div className="rounded-radius border border-border p-3">
      <p className="text-sm font-medium text-foreground">{parte.nm_parte}</p>
      <div className="mt-1 flex flex-col">
        <Linha rotulo="Telefone" valor={parte.ds_telefone} />
        <Linha rotulo="E-mail" valor={parte.ds_email} />
        <Linha rotulo="Profissão" valor={parte.ds_profissao} />
        <Linha rotulo="Conta bancária" valor={parte.ds_conta_bancaria} />
        <Linha rotulo="Identidade / CNH" valor={docLabel(parte.tp_doc_identidade)} />
        <Linha rotulo="Certidão de estado civil" valor={docLabel(parte.tp_doc_estado_civil)} />
        <Linha
          rotulo="Comprovante de residência"
          valor={docLabel(parte.tp_doc_comprovante_residencia)}
        />
        <Linha rotulo="Certidão de ônus / Escritura" valor={docLabel(parte.tp_doc_onus_escritura)} />
        <Linha rotulo="Observações" valor={parte.ds_documentos_obs} />
      </div>
    </div>
  );
}

export async function DadosNegocioSection({ cdProcesso }: { cdProcesso: string }) {
  const supabase = await createClient();

  const [{ data: negocio }, { data: partes }, { data: corretores }] = await Promise.all([
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
  ]);

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
              <ParteCard key={p.cd_parte} parte={p} />
            ))}
          </div>
        )}

        {compradores.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">Compradores</p>
            {compradores.map((p) => (
              <ParteCard key={p.cd_parte} parte={p} />
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
