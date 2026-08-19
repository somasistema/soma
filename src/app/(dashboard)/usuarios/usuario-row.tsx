"use client";

import { Pencil, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useState, useTransition } from "react";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ROLE_LABEL, type Imobiliaria, type RoleUsuario, type Usuario } from "@/types/database";
import { atualizarUsuario, excluirUsuario } from "./actions";
import { ToggleAtivoUsuario } from "./toggle-ativo-usuario";
import { ReenviarConviteButton } from "./reenviar-convite-button";

const ROLES_EDITAVEIS: RoleUsuario[] = [
  "master",
  "juridico",
  "imobiliaria",
  "despachante",
  "corretor",
  "gerente",
  "vendedor",
  "outro_cliente",
];

type UsuarioComImobiliaria = Usuario & {
  imobiliarias: Pick<Imobiliaria, "nm_imobiliaria"> | null;
};

export function UsuarioRow({
  usuario,
  imobiliarias,
  ehUsuarioAtual,
}: {
  usuario: UsuarioComImobiliaria;
  imobiliarias: Imobiliaria[];
  ehUsuarioAtual: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [excluindo, startExclusao] = useTransition();
  const [erroExclusao, setErroExclusao] = useState<string | null>(null);

  function salvar(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const resultado = await atualizarUsuario(usuario.cd_usuario, null, formData);
      if (!resultado.sucesso) {
        setErro(resultado.erro);
      } else {
        setEditando(false);
      }
    });
  }

  function excluir() {
    if (!confirm(`Excluir "${usuario.nm_usuario}"? Essa ação não pode ser desfeita.`)) return;
    setErroExclusao(null);
    startExclusao(async () => {
      const resultado = await excluirUsuario(usuario.cd_usuario);
      if (!resultado.sucesso) setErroExclusao(resultado.erro);
    });
  }

  if (editando) {
    return (
      <motion.tr layout className="border-t border-border bg-muted/30">
        <td colSpan={7} className="px-4 py-4">
          <form action={salvar} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input name="nm_usuario" placeholder="Nome" defaultValue={usuario.nm_usuario} required />
              <Input
                name="ds_email"
                type="email"
                placeholder="E-mail"
                defaultValue={usuario.ds_email}
                required
              />
              <Select name="tp_role" defaultValue={usuario.tp_role}>
                {ROLES_EDITAVEIS.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </Select>
              <Select name="cd_imobiliaria" defaultValue={usuario.cd_imobiliaria ?? ""}>
                <option value="">Nenhuma imobiliária</option>
                {imobiliarias.map((imobiliaria) => (
                  <option key={imobiliaria.cd_imobiliaria} value={imobiliaria.cd_imobiliaria}>
                    {imobiliaria.nm_imobiliaria}
                  </option>
                ))}
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Trocar o e-mail também troca o e-mail de login da pessoa.
            </p>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Salvando..." : "Salvar"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
            </div>
          </form>
        </td>
      </motion.tr>
    );
  }

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="border-t border-border hover:bg-muted/50"
    >
      <td className="px-4 py-3">{usuario.nm_usuario}</td>
      <td className="px-4 py-3 text-muted-foreground">{usuario.ds_email}</td>
      <td className="px-4 py-3">{ROLE_LABEL[usuario.tp_role]}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {usuario.imobiliarias?.nm_imobiliaria ?? "—"}
      </td>
      <td className="px-4 py-3">
        <AtivoBadge ativo={usuario.sn_ativo} />
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <ReenviarConviteButton email={usuario.ds_email} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setEditando(true)}
            aria-label="Editar"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {!ehUsuarioAtual && (
            <>
              <ToggleAtivoUsuario cdUsuario={usuario.cd_usuario} ativo={usuario.sn_ativo} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={excluindo}
                onClick={excluir}
                aria-label="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        {erroExclusao && <p className="mt-1 text-xs text-status-reprovado">{erroExclusao}</p>}
      </td>
    </motion.tr>
  );
}
