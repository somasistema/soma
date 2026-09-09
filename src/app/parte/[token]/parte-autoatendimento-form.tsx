"use client";

import { Check, Paperclip } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarTelefone } from "@/lib/utils";
import {
  CATEGORIA_DOC_INTAKE_LABEL,
  CATEGORIAS_DOC_COMPRADOR,
  CATEGORIAS_DOC_VENDEDOR,
  LADOS_COM_CHECKLIST,
  type CategoriaDocIntake,
  type ParteAutoatendimento,
} from "@/types/database";
import { anexarMeuDocumento, salvarMeusDados } from "./actions";

function DocumentosAvulsos({
  token,
  arquivos,
}: {
  token: string;
  arquivos: string[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    startTransition(async () => {
      const r = await anexarMeuDocumento(token, "geral", fd);
      if (inputRef.current) inputRef.current.value = "";
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {arquivos.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {arquivos.map((nome, i) => (
            <li
              key={i}
              className="flex items-center gap-2 border-t border-border py-1.5 text-sm text-foreground first:border-t-0"
            >
              <Check className="h-3.5 w-3.5 text-status-aceito" />
              {nome}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum documento anexado ainda.</p>
      )}
      <input ref={inputRef} type="file" className="hidden" onChange={aoSelecionar} />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit gap-1.5"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-3.5 w-3.5" />
        {pending ? "Enviando..." : "Anexar documento"}
      </Button>
      {erro && <span className="text-xs text-status-reprovado">{erro}</span>}
    </div>
  );
}

function LinhaDocumento({
  token,
  categoria,
  anexado,
}: {
  token: string;
  categoria: CategoriaDocIntake;
  anexado: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function aoSelecionar(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setErro(null);
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    startTransition(async () => {
      const r = await anexarMeuDocumento(token, categoria, fd);
      if (inputRef.current) inputRef.current.value = "";
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border py-2.5 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground">{CATEGORIA_DOC_INTAKE_LABEL[categoria]}</span>
        <div className="flex items-center gap-2">
          <input ref={inputRef} type="file" className="hidden" onChange={aoSelecionar} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={pending}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            {pending ? "Enviando..." : anexado ? "Substituir" : "Anexar"}
          </Button>
          {anexado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-status-aceito/15 px-2.5 py-0.5 text-xs font-medium text-status-aceito">
              <Check className="h-3 w-3" /> Anexado
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-status-reprovado/15 px-2.5 py-0.5 text-xs font-medium text-status-reprovado">
              Falta
            </span>
          )}
        </div>
      </div>
      {erro && <span className="text-xs text-status-reprovado">{erro}</span>}
    </div>
  );
}

export function ParteAutoatendimentoForm({
  token,
  parte,
}: {
  token: string;
  parte: ParteAutoatendimento;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const [nm, setNm] = useState(parte.nm_parte ?? "");
  const [tel, setTel] = useState(parte.ds_telefone ?? "");
  const [email, setEmail] = useState(parte.ds_email ?? "");
  const [profissao, setProfissao] = useState(parte.ds_profissao ?? "");
  const [conta, setConta] = useState(parte.ds_conta_bancaria ?? "");

  const temChecklist = LADOS_COM_CHECKLIST.includes(parte.tp_lado);
  const categorias =
    parte.tp_lado === "vendedor" ? CATEGORIAS_DOC_VENDEDOR : CATEGORIAS_DOC_COMPRADOR;
  const anexadas = new Set(parte.documentos.map((d) => d.tp_categoria_intake));
  const avulsos = parte.documentos.filter((d) => !d.tp_categoria_intake).map((d) => d.nm_arquivo);

  function salvar() {
    setMsg(null);
    if (!nm.trim()) {
      setMsg({ ok: false, texto: "Informe seu nome." });
      return;
    }
    startTransition(async () => {
      const r = await salvarMeusDados(token, {
        nm_parte: nm.trim(),
        ds_telefone: tel,
        ds_email: email,
        ds_profissao: profissao,
        ds_conta_bancaria: conta,
      });
      if (!r.sucesso) {
        setMsg({ ok: false, texto: r.erro });
        return;
      }
      setMsg({ ok: true, texto: "Dados salvos." });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Meus dados</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nm">Nome completo</Label>
            <Input id="nm" value={nm} onChange={(e) => setNm(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tel">Telefone</Label>
            <Input
              id="tel"
              type="tel"
              placeholder="(71) 99999-9999"
              value={tel}
              onChange={(e) => setTel(formatarTelefone(e.target.value))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profissao">Profissão</Label>
            <Input
              id="profissao"
              value={profissao}
              onChange={(e) => setProfissao(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="conta">Conta bancária</Label>
            <Input
              id="conta"
              placeholder="Banco, agência e conta"
              value={conta}
              onChange={(e) => setConta(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" onClick={salvar} disabled={pending}>
              {pending ? "Salvando..." : "Salvar meus dados"}
            </Button>
            {msg && (
              <p
                className={`mt-2 text-sm ${msg.ok ? "text-status-aceito" : "text-status-reprovado"}`}
              >
                {msg.texto}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meus documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2 text-sm text-muted-foreground">
            Anexe foto ou PDF. Pode substituir depois se precisar.
          </p>
          {temChecklist ? (
            categorias.map((categoria) => (
              <LinhaDocumento
                key={categoria}
                token={token}
                categoria={categoria}
                anexado={anexadas.has(categoria)}
              />
            ))
          ) : (
            <DocumentosAvulsos token={token} arquivos={avulsos} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
