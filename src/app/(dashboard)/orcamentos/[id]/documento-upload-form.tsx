"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PERFIL_DOCUMENTO_LABEL, type PerfilDocumento } from "@/types/database";
import { uploadDocumento } from "./documentos-actions";

const PERFIS = Object.keys(PERFIL_DOCUMENTO_LABEL) as PerfilDocumento[];

export function DocumentoUploadForm({ cdProcesso }: { cdProcesso: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    const formData = new FormData(evento.currentTarget);

    startTransition(async () => {
      const resultado = await uploadDocumento(formData);

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={enviar}
      className="flex flex-col gap-3 rounded-radius border border-border p-4"
    >
      <input type="hidden" name="cd_processo" value={cdProcesso} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tp_perfil_alvo">Perfil alvo</Label>
          <Select id="tp_perfil_alvo" name="tp_perfil_alvo" defaultValue="" required>
            <option value="" disabled>
              Selecione...
            </option>
            {PERFIS.map((perfil) => (
              <option key={perfil} value={perfil}>
                {PERFIL_DOCUMENTO_LABEL[perfil]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nm_tipo_documento">Tipo de documento</Label>
          <Input
            id="nm_tipo_documento"
            name="nm_tipo_documento"
            placeholder="Ex: RG, comprovante de residência..."
            required
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="arquivo">Arquivo</Label>
        <Input id="arquivo" name="arquivo" type="file" required />
      </div>

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Enviando..." : "Enviar documento"}
      </Button>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </form>
  );
}
