"use client";

import { Copy, FilePlus2, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { prepararArquivo } from "@/lib/arquivo-cliente";
import type { ModeloContratoVersao } from "@/types/database";
import { duplicarModelo, importarModeloDocx } from "../actions";
import { EditorModelo } from "../editor-modelo";

type Partida = { texto: string; nome: string };

// Três jeitos de começar: em branco, importando um arquivo Word ou copiando um modelo existente.
// Importar e "em branco" abrem o editor sem salvar nada; copiar já cria o modelo e abre ele.
export function NovoModeloFluxo({ existentes }: { existentes: { cd_modelo: string; nm_modelo: string }[] }) {
  const router = useRouter();
  const [partida, setPartida] = useState<Partida | null>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [copiar, setCopiar] = useState(existentes[0]?.cd_modelo ?? "");
  const arquivoRef = useRef<HTMLInputElement>(null);

  if (partida) {
    return <EditorModelo editavel versoes={[]} processos={[]} inicialTexto={partida.texto} inicialNome={partida.nome} />;
  }

  function importar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(null);
    startTransition(async () => {
      const preparado = await prepararArquivo(arquivo);
      if ("erro" in preparado) {
        setErro(preparado.erro);
        return;
      }
      const fd = new FormData();
      fd.set("arquivo", preparado.arquivo);
      const r = await importarModeloDocx(fd);
      if ("erro" in r) setErro(r.erro);
      else setPartida({ texto: r.texto, nome: r.nome });
    });
  }

  function duplicar() {
    setErro(null);
    startTransition(async () => {
      const r = await duplicarModelo(copiar);
      if ("erro" in r) setErro(r.erro);
      else router.push(`/configuracoes/modelos-contrato/${r.cd_modelo}`);
    });
  }

  const cartao = "flex flex-col gap-3 rounded-radius border border-border bg-card p-5";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif-doc text-xl font-semibold text-foreground">Novo modelo</h2>
        <p className="text-sm text-muted-foreground">Como você quer começar?</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className={cartao}>
          <FileUp className="h-6 w-6 text-accent" />
          <p className="text-sm font-semibold text-foreground">Importar de um arquivo Word</p>
          <p className="text-xs text-muted-foreground">
            Escolha o contrato (.docx). O texto entra no editor; depois é só trocar os dados fixos (nomes,
            CPF, valores) pelos campos do processo.
          </p>
          <input ref={arquivoRef} type="file" accept=".docx" className="hidden" onChange={importar} />
          <Button type="button" disabled={pending} onClick={() => arquivoRef.current?.click()}>
            {pending ? "Lendo o arquivo..." : "Escolher arquivo .docx"}
          </Button>
        </div>

        <div className={cartao}>
          <Copy className="h-6 w-6 text-accent" />
          <p className="text-sm font-semibold text-foreground">Copiar um modelo existente</p>
          <p className="text-xs text-muted-foreground">
            Bom para uma variação (outro banco, sem financiamento...). Cria uma cópia e abre para editar.
          </p>
          <select
            value={copiar}
            onChange={(e) => setCopiar(e.target.value)}
            className="h-9 rounded-radius border border-border bg-background px-2 text-sm text-foreground"
            aria-label="Modelo a copiar"
          >
            {existentes.map((m) => (
              <option key={m.cd_modelo} value={m.cd_modelo}>
                {m.nm_modelo}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" disabled={pending || !copiar} onClick={duplicar}>
            Criar cópia
          </Button>
        </div>

        <div className={cartao}>
          <FilePlus2 className="h-6 w-6 text-accent" />
          <p className="text-sm font-semibold text-foreground">Começar em branco</p>
          <p className="text-xs text-muted-foreground">
            Escreva ou cole o texto no editor. Você pode colar direto do Word.
          </p>
          <Button type="button" variant="outline" onClick={() => setPartida({ texto: "", nome: "" })}>
            Abrir editor vazio
          </Button>
        </div>
      </div>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </div>
  );
}

export type { ModeloContratoVersao };
