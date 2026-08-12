"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/select";

const ROTULO_TABELA: Record<string, string> = {
  processos: "Processos",
  orcamentos: "Orçamentos",
  orcamento_servicos: "Itens de orçamento",
  pendencias: "Pendências",
  documentos: "Documentos",
  andamentos: "Andamentos",
  servicos: "Serviços",
  servico_precos: "Preços de serviço",
  tabela_custas: "Taxas e Emolumentos",
  pacote_itens: "Pacotes",
  cidades: "Cidades",
  fluxo_blocos: "Fluxo",
  perfil_acesso: "Perfil de acesso",
  imobiliarias: "Imobiliárias",
  usuarios: "Usuários",
};

export function AuditoriaFiltro({
  tabelas,
  atual,
}: {
  tabelas: string[];
  atual: string;
}) {
  const router = useRouter();

  return (
    <Select
      value={atual}
      onChange={(e) => {
        const valor = e.target.value;
        router.push(valor ? `/configuracoes/auditoria?tabela=${valor}` : "/configuracoes/auditoria");
      }}
      className="w-64"
    >
      <option value="">Todas as tabelas</option>
      {tabelas.map((tabela) => (
        <option key={tabela} value={tabela}>
          {ROTULO_TABELA[tabela] ?? tabela}
        </option>
      ))}
    </Select>
  );
}
