"use client";

import { Check, Paperclip, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarTelefone } from "@/lib/utils";
import { checklistDaPessoa } from "@/lib/checklist-partes";
import {
  CATEGORIA_DOC_INTAKE_LABEL,
  CATEGORIAS_DOC_IMOVEL,
  LADOS_COM_CHECKLIST,
  type CategoriaDocIntake,
  type ParteAutoatendimento,
} from "@/types/database";
import { anexarMeuDocumento, removerMeuDocumento, salvarMeusDados } from "./actions";

// Arquivo listado na tela. sn_meu = false: mandado por outra pessoa
// (ex: o outro vendedor), só aparece — não dá pra remover daqui.
type ArquivoEnviado = { cd_documento: string; nm_arquivo: string; sn_meu?: boolean };

function ListaArquivos({ token, arquivos }: { token: string; arquivos: ArquivoEnviado[] }) {
  const router = useRouter();
  const [removendo, startRemover] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function remover(arquivo: ArquivoEnviado) {
    if (!confirm(`Remover "${arquivo.nm_arquivo}"?`)) return;
    setErro(null);
    startRemover(async () => {
      const r = await removerMeuDocumento(token, arquivo.cd_documento);
      if (!r.sucesso) {
        setErro(r.erro);
        return;
      }
      router.refresh();
    });
  }

  if (arquivos.length === 0) return null;

  return (
    <ul className="flex flex-col gap-0.5">
      {arquivos.map((arquivo) => (
        <li
          key={arquivo.cd_documento}
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Check className="h-3 w-3 shrink-0 text-status-aceito" />
          <span className="min-w-0 truncate">{arquivo.nm_arquivo}</span>
          {arquivo.sn_meu !== false && (
            <button
              type="button"
              disabled={removendo}
              onClick={() => remover(arquivo)}
              aria-label={`Remover ${arquivo.nm_arquivo}`}
              className="shrink-0 rounded p-0.5 hover:bg-muted hover:text-status-reprovado disabled:opacity-50"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </li>
      ))}
      {erro && <li className="text-xs text-status-reprovado">{erro}</li>}
    </ul>
  );
}

function BotaoAnexar({
  token,
  categoria,
  rotulo,
}: {
  token: string;
  categoria: CategoriaDocIntake | "geral";
  rotulo: string;
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
    <span className="inline-flex flex-col items-end gap-1">
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
        {pending ? "Enviando..." : rotulo}
      </Button>
      {erro && <span className="text-xs text-status-reprovado">{erro}</span>}
    </span>
  );
}

function DocumentosAvulsos({ token, arquivos }: { token: string; arquivos: ArquivoEnviado[] }) {
  return (
    <div className="flex flex-col gap-2">
      {arquivos.length > 0 ? (
        <ListaArquivos token={token} arquivos={arquivos} />
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum documento anexado ainda.</p>
      )}
      <div>
        <BotaoAnexar token={token} categoria="geral" rotulo="Anexar documento" />
      </div>
    </div>
  );
}

function LinhaDocumento({
  token,
  categoria,
  arquivos,
  parceiro,
}: {
  token: string;
  categoria: CategoriaDocIntake;
  arquivos: ArquivoEnviado[];
  // item que vale pro casal: o que o cônjuge/companheiro(a) já mandou
  parceiro?: { nome: string; arquivos: string[] } | null;
}) {
  const anexado = arquivos.length > 0 || (parceiro?.arquivos.length ?? 0) > 0;

  return (
    <div className="flex flex-col gap-1.5 border-t border-border py-2.5 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground">
          {CATEGORIA_DOC_INTAKE_LABEL[categoria]}
          {parceiro && (
            <span className="block text-xs text-muted-foreground">
              Vale pro casal — basta um de vocês mandar.
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <BotaoAnexar
            token={token}
            categoria={categoria}
            rotulo={anexado ? "Mais um (ex: verso)" : "Anexar"}
          />
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
      <ListaArquivos token={token} arquivos={arquivos} />
      {parceiro && parceiro.arquivos.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Já enviado por {parceiro.nome}: {parceiro.arquivos.join(", ")}
        </p>
      )}
    </div>
  );
}

function CampoTexto({
  id,
  label,
  value,
  onChange,
  tipo,
  placeholder,
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  tipo?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={tipo}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
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
  const [cpf, setCpf] = useState(parte.ds_cpf ?? "");
  const [rg, setRg] = useState(parte.ds_rg ?? "");
  const [nascimento, setNascimento] = useState((parte.dt_nascimento ?? "").slice(0, 10));
  const [endereco, setEndereco] = useState(parte.ds_endereco ?? "");

  const temChecklist = LADOS_COM_CHECKLIST.includes(parte.tp_lado);
  const parceiro = parte.parceiro ?? null;
  const itens = checklistDaPessoa(parceiro?.tp_vinculo ?? null);
  const avulsos = parte.documentos.filter((d) => !d.tp_categoria_intake);

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
        ds_cpf: cpf,
        ds_rg: rg,
        dt_nascimento: nascimento,
        ds_endereco: endereco,
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
          <CampoTexto id="nm" label="Nome completo" value={nm} onChange={setNm} className="sm:col-span-2" />
          <CampoTexto id="cpf" label="CPF" value={cpf} onChange={setCpf} />
          <CampoTexto id="rg" label="RG" value={rg} onChange={setRg} />
          <CampoTexto id="nasc" label="Data de nascimento" tipo="date" value={nascimento} onChange={setNascimento} />
          <CampoTexto id="profissao" label="Profissão" value={profissao} onChange={setProfissao} />
          <CampoTexto
            id="tel"
            label="Telefone"
            tipo="tel"
            placeholder="(71) 99999-9999"
            value={tel}
            onChange={(v) => setTel(formatarTelefone(v))}
          />
          <CampoTexto id="email" label="E-mail" tipo="email" value={email} onChange={setEmail} />
          <CampoTexto
            id="endereco"
            label="Endereço"
            placeholder="Rua, número, bairro, cidade/UF"
            value={endereco}
            onChange={setEndereco}
            className="sm:col-span-2"
          />
          <CampoTexto
            id="conta"
            label="Conta bancária"
            placeholder="Banco, agência e conta"
            value={conta}
            onChange={setConta}
            className="sm:col-span-2"
          />
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
            Anexe foto ou PDF. Se o documento tiver frente e verso, mande os dois. Mandou errado?
            Remova no X e anexe de novo.
          </p>
          {temChecklist ? (
            itens.map((item) => (
              <LinhaDocumento
                key={item.categoria}
                token={token}
                categoria={item.categoria}
                arquivos={parte.documentos.filter((d) => d.tp_categoria_intake === item.categoria)}
                parceiro={
                  item.compartilhado && parceiro
                    ? {
                        nome: parceiro.nm_parte,
                        arquivos: parceiro.documentos
                          .filter((d) => d.tp_categoria_intake === item.categoria)
                          .map((d) => d.nm_arquivo),
                      }
                    : null
                }
              />
            ))
          ) : (
            <DocumentosAvulsos token={token} arquivos={avulsos} />
          )}
        </CardContent>
      </Card>

      {parte.documentos_imovel && (
        <Card>
          <CardHeader>
            <CardTitle>Documentos do imóvel</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-2 text-sm text-muted-foreground">
              Um conjunto só pro imóvel — se outro vendedor já mandou, não precisa repetir.
            </p>
            {CATEGORIAS_DOC_IMOVEL.map((categoria) => (
              <LinhaDocumento
                key={categoria}
                token={token}
                categoria={categoria}
                arquivos={(parte.documentos_imovel ?? []).filter(
                  (d) => d.tp_categoria_intake === categoria
                )}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
