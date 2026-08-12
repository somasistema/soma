import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FadeIn } from "@/components/motion/fade-in";
import { StaggerTableBody } from "@/components/motion/stagger-list";
import { exigirAcessoSecao, getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Imobiliaria, Usuario } from "@/types/database";
import { UsuarioForm } from "./usuario-form";
import { UsuarioRow } from "./usuario-row";

type UsuarioComImobiliaria = Usuario & {
  imobiliarias: Pick<Imobiliaria, "nm_imobiliaria"> | null;
};

export default async function UsuariosPage() {
  const usuarioAtual = await getUsuarioAtual();
  await exigirAcessoSecao(usuarioAtual, "usuarios");

  const supabase = await createClient();

  const [{ data: usuarios }, { data: imobiliarias }] = await Promise.all([
    supabase
      .schema("soma")
      .from("usuarios")
      .select("*, imobiliarias(nm_imobiliaria)")
      .order("ts_criacao", { ascending: false })
      .returns<UsuarioComImobiliaria[]>(),
    supabase
      .schema("soma")
      .from("imobiliarias")
      .select("*")
      .eq("sn_ativo", true)
      .order("nm_imobiliaria")
      .returns<Imobiliaria[]>(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-serif-doc text-2xl font-semibold text-foreground">
        <Users className="h-6 w-6 text-accent" />
        Usuários
      </h1>

      <UsuarioForm imobiliarias={imobiliarias ?? []} />

      <FadeIn delay={0.06}>
        <Card>
          <CardHeader>
            <CardTitle>Todos os usuários</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nome</th>
                    <th className="px-4 py-3 font-medium">E-mail</th>
                    <th className="px-4 py-3 font-medium">Perfil</th>
                    <th className="px-4 py-3 font-medium">Imobiliária</th>
                    <th className="px-4 py-3 font-medium">Criado em</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <StaggerTableBody>
                  {(usuarios ?? []).map((usuario) => (
                    <UsuarioRow
                      key={usuario.cd_usuario}
                      usuario={usuario}
                      imobiliarias={imobiliarias ?? []}
                      ehUsuarioAtual={usuario.cd_usuario === usuarioAtual.cd_usuario}
                    />
                  ))}
                  {(!usuarios || usuarios.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                        Nenhum usuário cadastrado.
                      </td>
                    </tr>
                  )}
                </StaggerTableBody>
              </table>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </div>
  );
}
