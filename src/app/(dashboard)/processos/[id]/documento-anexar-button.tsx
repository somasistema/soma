"use client";

import { Paperclip } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { LadoParte } from "@/types/database";
import { uploadDocumento } from "../../orcamentos/[id]/documentos-actions";

// Anexa um documento já vinculado a uma parte + categoria do checklist.
// Ao subir, o status daquele item passa a ser "OK" automaticamente.
export function DocumentoAnexarButton({
  cdProcesso,
  cdParte,
  tpLado,
  tpCategoria,
  rotuloCategoria,
}: {
  cdProcesso: string;
  cdParte: string;
  tpLado: LadoParte;
  tpCategoria: string;
  rotuloCategoria: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function escolher() {
    inputRef.current?.click();
  }

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);

    const fd = new FormData();
    fd.set("cd_processo", cdProcesso);
    fd.set("cd_parte", cdParte);
    fd.set("tp_perfil_alvo", tpLado === "vendedor" || tpLado === "comprador" ? tpLado : "outro");
    fd.set("tp_categoria_intake", tpCategoria);
    fd.set("nm_tipo_documento", rotuloCategoria);
    fd.set("arquivo", arquivo);

    startTransition(async () => {
      const r = await uploadDocumento(fd);
      if (inputRef.current) inputRef.current.value = "";
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <input ref={inputRef} type="file" className="hidden" onChange={aoSelecionar} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2 text-xs"
        disabled={pending}
        onClick={escolher}
      >
        <Paperclip className="h-3 w-3" />
        {pending ? "Anexando..." : "Anexar"}
      </Button>
      {erro && <span className="text-xs text-status-reprovado">{erro}</span>}
    </span>
  );
}
