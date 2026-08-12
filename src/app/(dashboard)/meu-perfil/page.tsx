import { UserCircle } from "lucide-react";
import { getUsuarioAtual } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABEL } from "@/types/database";
import { MeuPerfilForm } from "./meu-perfil-form";
import { TrocarSenhaForm } from "./trocar-senha-form";

export default async function MeuPerfilPage() {
  const usuario = await getUsuarioAtual();

  let nomeImobiliaria: string | null = null;
  if (usuario.cd_imobiliaria) {
    const supabase = await createClient();
    const { data } = await supabase
      .schema("soma")
      .from("imobiliarias")
      .select("nm_imobiliaria")
      .eq("cd_imobiliaria", usuario.cd_imobiliaria)
      .maybeSingle<{ nm_imobiliaria: string }>();
    nomeImobiliaria = data?.nm_imobiliaria ?? null;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="flex items-center gap-2 font-serif-doc text-2xl font-semibold text-foreground">
        <UserCircle className="h-6 w-6 text-accent" />
        Meu perfil
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Meus dados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</p>
              <p className="text-foreground">{usuario.ds_email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Perfil</p>
              <p className="text-foreground">{ROLE_LABEL[usuario.tp_role]}</p>
            </div>
            {nomeImobiliaria && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Imobiliária</p>
                <p className="text-foreground">{nomeImobiliaria}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            E-mail e perfil só podem ser alterados por um Master, em Usuários.
          </p>

          <MeuPerfilForm nmUsuario={usuario.nm_usuario} dsTelefone={usuario.ds_telefone ?? ""} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trocar senha</CardTitle>
        </CardHeader>
        <CardContent>
          <TrocarSenhaForm />
        </CardContent>
      </Card>
    </div>
  );
}
