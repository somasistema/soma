"use client";

import { Paperclip } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CATEGORIAS_DOC_IMOVEL, type CategoriaDocIntake, type LadoParte } from "@/types/database";
import { uploadDocumento } from "../../orcamentos/[id]/documentos-actions";

// Anexa um documento já vinculado a um item do checklist — de uma parte
// (cdParte) ou do imóvel (cdParte null). Ao subir, o item vira "OK".
// Pode anexar mais de um arquivo no mesmo item (frente e verso).
export function DocumentoAnexarButton({
  cdProcesso,
  cdParte,
  tpLado,
  tpCategoria,
  rotuloCategoria,
  rotuloBotao = "Anexar",
}: {
  cdProcesso: string;
  cdParte: string | null;
  tpLado: LadoParte | null;
  tpCategoria: CategoriaDocIntake;
  rotuloCategoria: string;
  rotuloBotao?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const perfil = CATEGORIAS_DOC_IMOVEL.includes(tpCategoria)
    ? "imovel"
    : tpLado === "vendedor" || tpLado === "comprador"
      ? tpLado
      : "outro";

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);

    const fd = new FormData();
    fd.set("cd_processo", cdProcesso);
    if (cdParte) fd.set("cd_parte", cdParte);
    fd.set("tp_perfil_alvo", perfil);
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
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-3 w-3" />
        {pending ? "Anexando..." : rotuloBotao}
      </Button>
      {erro && <span className="text-xs text-status-reprovado">{erro}</span>}
    </span>
  );
}
