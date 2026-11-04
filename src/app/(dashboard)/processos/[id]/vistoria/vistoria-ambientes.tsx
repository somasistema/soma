"use client";

import { Camera, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { prepararArquivo } from "@/lib/arquivo-cliente";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  criarAmbiente,
  descreverPelasFotos,
  enviarFoto,
  excluirAmbiente,
  excluirFoto,
  salvarAmbiente,
} from "./vistoria-actions";

export type AmbienteVista = {
  cd_ambiente: string;
  nm_ambiente: string;
  ds_descricao: string | null;
  fotos: { cd_foto: string; url: string | null }[];
};

const SUGESTOES = [
  "Varanda/entrada",
  "Sala",
  "Cozinha",
  "Área de serviço",
  "Quarto 1",
  "Quarto 2",
  "Suíte",
  "Banheiro social",
  "Banheiro da suíte",
  "Garagem",
];

function Ambiente({ cdProcesso, ambiente }: { cdProcesso: string; ambiente: AmbienteVista }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState(ambiente.nm_ambiente);
  const [descricao, setDescricao] = useState(ambiente.ds_descricao ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const alterado = nome !== ambiente.nm_ambiente || descricao !== (ambiente.ds_descricao ?? "");

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      const r = await salvarAmbiente(cdProcesso, ambiente.cd_ambiente, nome, descricao);
      setMsg(r.sucesso ? { ok: true, texto: "Salvo." } : { ok: false, texto: r.erro });
      if (r.sucesso) router.refresh();
    });
  }

  function excluir() {
    if (!confirm(`Excluir o ambiente "${ambiente.nm_ambiente}" e as fotos dele?`)) return;
    startTransition(async () => {
      const r = await excluirAmbiente(cdProcesso, ambiente.cd_ambiente);
      if (!r.sucesso) setMsg({ ok: false, texto: r.erro });
      else router.refresh();
    });
  }

  async function aoEscolherFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (arquivos.length === 0) return;
    setMsg(null);
    // Uma por vez: foto de celular é grande e cada chamada tem limite de tamanho.
    for (let i = 0; i < arquivos.length; i++) {
      setEnviando(`Enviando foto ${i + 1} de ${arquivos.length}...`);
      const preparado = await prepararArquivo(arquivos[i]);
      if ("erro" in preparado) {
        setMsg({ ok: false, texto: preparado.erro });
        break;
      }
      const fd = new FormData();
      fd.set("arquivo", preparado.arquivo);
      const r = await enviarFoto(cdProcesso, ambiente.cd_ambiente, fd);
      if (!r.sucesso) {
        setMsg({ ok: false, texto: `${arquivos[i].name}: ${r.erro}` });
        break;
      }
    }
    setEnviando(null);
    router.refresh();
  }

  function removerFoto(cdFoto: string) {
    startTransition(async () => {
      const r = await excluirFoto(cdProcesso, cdFoto);
      if (!r.sucesso) setMsg({ ok: false, texto: r.erro });
      else router.refresh();
    });
  }

  function descrever() {
    if (descricao.trim() && !confirm("Já existe uma descrição. Substituir pela sugestão da IA?")) return;
    setMsg(null);
    startTransition(async () => {
      const r = await descreverPelasFotos(cdProcesso, ambiente.cd_ambiente);
      if (!r.sucesso) {
        setMsg({ ok: false, texto: r.erro });
        return;
      }
      setDescricao(r.texto);
      setMsg({ ok: true, texto: "Sugestão da IA colocada abaixo. Confira, ajuste e clique em Salvar." });
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-radius border border-border p-4">
      <div className="flex items-center gap-2">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} aria-label="Nome do ambiente" className="font-medium" />
        <Button type="button" variant="ghost" size="icon" onClick={excluir} disabled={pending} aria-label="Excluir ambiente">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {ambiente.fotos.map((f) => (
          <div key={f.cd_foto} className="relative h-24 w-32 overflow-hidden rounded-radius border border-border bg-muted">
            {f.url && (
              // eslint-disable-next-line @next/next/no-img-element -- URL assinada do storage
              <img src={f.url} alt={`Foto de ${ambiente.nm_ambiente}`} className="h-full w-full object-cover" />
            )}
            <button
              type="button"
              onClick={() => removerFoto(f.cd_foto)}
              disabled={pending}
              aria-label="Remover foto"
              className="absolute right-1 top-1 rounded bg-background/90 p-0.5 hover:text-status-reprovado"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={aoEscolherFotos} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={!!enviando}
          className="flex h-24 w-32 flex-col items-center justify-center gap-1 rounded-radius border border-dashed border-border text-xs text-muted-foreground hover:bg-muted disabled:opacity-60"
        >
          <Camera className="h-5 w-5" />
          {enviando ? "Enviando..." : "Adicionar fotos"}
        </button>
      </div>
      {enviando && <p className="text-xs text-muted-foreground">{enviando}</p>}

      <textarea
        rows={8}
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder={"a) Piso: ...\nb) Paredes: ...\nc) Contém: ...\nd) Observação: ..."}
        className="w-full rounded-radius border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={salvar} disabled={pending || !alterado}>
          Salvar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={descrever}
          disabled={pending || ambiente.fotos.length === 0}
          title={ambiente.fotos.length === 0 ? "Adicione fotos primeiro" : undefined}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {pending ? "Lendo as fotos..." : "Descrever pelas fotos (IA)"}
        </Button>
        {msg && <span className={`text-xs ${msg.ok ? "text-status-aceito" : "text-status-reprovado"}`}>{msg.texto}</span>}
      </div>
    </div>
  );
}

export function VistoriaAmbientes({
  cdProcesso,
  ambientes,
}: {
  cdProcesso: string;
  ambientes: AmbienteVista[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function adicionar() {
    setErro(null);
    startTransition(async () => {
      const r = await criarAmbiente(cdProcesso, nome);
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      setNome("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {ambientes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum ambiente ainda. Adicione o primeiro abaixo, envie as fotos e peça a descrição.
        </p>
      )}
      {ambientes.map((a) => (
        <Ambiente key={`${a.cd_ambiente}-${a.ds_descricao ?? ""}-${a.nm_ambiente}`} cdProcesso={cdProcesso} ambiente={a} />
      ))}

      <div className="flex flex-wrap items-end gap-2 rounded-radius border border-dashed border-border p-3">
        <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
          <label htmlFor="novo-ambiente" className="text-xs text-muted-foreground">
            Novo ambiente
          </label>
          <Input
            id="novo-ambiente"
            list="sugestoes-ambiente"
            placeholder="Ex: Sala, Quarto 1, Cozinha"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") adicionar();
            }}
          />
          <datalist id="sugestoes-ambiente">
            {SUGESTOES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <Button type="button" onClick={adicionar} disabled={pending || !nome.trim()}>
          Adicionar ambiente
        </Button>
        {erro && <p className="w-full text-xs text-status-reprovado">{erro}</p>}
      </div>
    </div>
  );
}
