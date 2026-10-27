import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LADO_PARTE_LABEL } from "@/types/database";
import { carregarDadosNegocio, ParteCard, PLURAL_LADO } from "./dados-negocio-comum";

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
      </CardContent>
    </Card>
  );
}
