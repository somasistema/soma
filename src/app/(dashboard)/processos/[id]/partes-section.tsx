import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { LADO_PARTE_LABEL } from "@/types/database";
import { carregarDadosNegocio, ParteCard, PLURAL_LADO } from "./dados-negocio-comum";

// A imobiliária do processo: o e-mail dela (cadastro em Configurações) é pra
// onde vai a minuta e o contrato pra assinar.
async function ImobiliariaDoProcesso({ cdProcesso }: { cdProcesso: string }) {
  const supabase = await createClient();
  const { data: processo } = await supabase
    .schema("soma")
    .from("processos")
    .select("cd_imobiliaria")
    .eq("cd_processo", cdProcesso)
    .maybeSingle();
  if (!processo?.cd_imobiliaria) return null;

  const { data: imob } = await supabase
    .schema("soma")
    .from("imobiliarias")
    .select("nm_imobiliaria, ds_email, ds_telefone")
    .eq("cd_imobiliaria", processo.cd_imobiliaria)
    .maybeSingle();
  if (!imob) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">Imobiliária</p>
      <div className="flex flex-col gap-1 rounded-radius border border-border p-3 text-sm">
        <span className="font-medium text-foreground">{imob.nm_imobiliaria}</span>
        {imob.ds_email ? (
          <span className="text-muted-foreground">E-mail: {imob.ds_email}</span>
        ) : (
          <span className="text-status-reprovado">
            Sem e-mail cadastrado — a minuta e o contrato não conseguem ser enviados para ela.{" "}
            <Link href="/configuracoes/imobiliarias" className="underline">
              Cadastrar em Configurações › Imobiliárias
            </Link>
          </span>
        )}
        {imob.ds_telefone && <span className="text-muted-foreground">Telefone: {imob.ds_telefone}</span>}
      </div>
    </div>
  );
}

export async function PartesSection({
  cdProcesso,
  numeroProcesso,
}: {
  cdProcesso: string;
  numeroProcesso: string;
}) {
  const { linkBase, grupos, todasPartes, docsPorParte } = await carregarDadosNegocio(cdProcesso);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partes do negócio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {grupos.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhuma parte informada na abertura do processo.
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
        <ImobiliariaDoProcesso cdProcesso={cdProcesso} />
      </CardContent>
    </Card>
  );
}
