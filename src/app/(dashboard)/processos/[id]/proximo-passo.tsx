import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TipoEtapaContrato } from "@/types/database";

// O que fazer agora, pela etapa do contrato e pelas pendências abertas.
export function ProximoPasso({
  cdProcesso,
  etapa,
  pendenciasAbertas,
  temMinuta,
}: {
  cdProcesso: string;
  etapa: TipoEtapaContrato | null;
  pendenciasAbertas: number;
  temMinuta: boolean;
}) {
  const base = `/processos/${cdProcesso}`;
  let titulo: string;
  let detalhe: string;
  let href: string | null = null;
  let acao = "Abrir";

  switch (etapa) {
    case "documentacao":
      if (pendenciasAbertas > 0) {
        titulo = `${pendenciasAbertas} pendência${pendenciasAbertas > 1 ? "s" : ""} em aberto`;
        detalhe = "Resolva as pendências do checklist e confira os documentos das partes.";
        href = `${base}/partes`;
        acao = "Ver partes e documentos";
      } else if (!temMinuta) {
        titulo = "Gerar a minuta do contrato";
        detalhe =
          "Documentação sem pendências: escolha o modelo e gere a minuta para as 5 aprovações.";
        href = `${base}/minuta`;
        acao = "Ir para a minuta";
      } else {
        titulo = "Conferir os documentos";
        detalhe = "Valide ou rejeite os documentos enviados.";
        href = `${base}/documentos`;
        acao = "Ver documentos";
      }
      break;
    case "minuta_pendente":
      titulo = "Minuta aguardando aprovação";
      detalhe =
        "As 5 frentes (corretor, comprador, vendedor, imobiliária e jurídico) precisam aprovar.";
      href = `${base}/minuta`;
      acao = "Ver aprovações";
      break;
    case "minuta_reprovada":
      titulo = "Minuta reprovada";
      detalhe = "Veja o comentário de quem reprovou, edite a minuta e envie uma nova versão.";
      href = `${base}/minuta`;
      acao = "Editar minuta";
      break;
    case "aguardando_assinatura":
      titulo = "Aguardando assinaturas";
      detalhe = "O contrato foi enviado. Acompanhe quem já assinou ou reenvie se necessário.";
      href = `${base}/minuta`;
      acao = "Ver assinaturas";
      break;
    case "concluido":
      titulo = "Contrato concluído";
      detalhe = "Todas as assinaturas foram feitas.";
      break;
    default:
      return null;
  }

  return (
    <Card className="border-brand/30 bg-brand/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Próximo passo
          </p>
          <p className="font-serif-doc text-lg font-semibold text-foreground">{titulo}</p>
          <p className="text-sm text-muted-foreground">{detalhe}</p>
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-brand-foreground hover:opacity-90"
          >
            {acao}
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
