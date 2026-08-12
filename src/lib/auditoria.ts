import { createServiceRoleClient } from "@/lib/supabase/server";

// Grava um evento no log de auditoria — usado só onde o trigger de
// banco (ver migration 033) não se aplica: soma.usuarios, cujas
// escritas passam por service_role (fora do contexto de sessão do
// usuário logado, então auth.uid() no trigger ficaria NULL).
export async function registrarAuditoria({
  cdUsuario,
  nmTabela,
  tpOperacao,
  cdRegistro,
  dadosAntigos,
  dadosNovos,
}: {
  cdUsuario: string | null;
  nmTabela: string;
  tpOperacao: "INSERT" | "UPDATE" | "DELETE";
  cdRegistro: string;
  dadosAntigos?: Record<string, unknown> | null;
  dadosNovos?: Record<string, unknown> | null;
}) {
  const supabase = createServiceRoleClient();
  await supabase.schema("soma").from("log_auditoria").insert({
    cd_usuario: cdUsuario,
    nm_tabela: nmTabela,
    tp_operacao: tpOperacao,
    cd_registro: cdRegistro,
    dados_antigos: dadosAntigos ?? null,
    dados_novos: dadosNovos ?? null,
  });
}
