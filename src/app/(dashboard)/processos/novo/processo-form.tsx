"use client";

import { Link2, Paperclip, PenLine, Plus, Trash2, X } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DocumentoFiscalInput } from "@/components/ui/documento-fiscal-input";
import { tipoDocumentoFiscal } from "@/lib/documento-fiscal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PercentInput } from "@/components/ui/percent-input";
import { Select } from "@/components/ui/select";
import { formatarMoeda, formatarTelefone } from "@/lib/utils";
import {
  CARTORIOS_IMOVEIS,
  CATEGORIA_DOC_INTAKE_LABEL,
  CATEGORIAS_DOC_IMOVEL,
  CATEGORIAS_DOC_EMPRESA,
  CATEGORIAS_DOC_PESSOAIS,
  LADO_PARTE_LABEL,
  VINCULO_PARTE_LABEL,
  type Corretor,
  type CategoriaDocIntake,
  type Imobiliaria,
  type LadoParte,
  type ProcessoParte,
  type VinculoParte,
} from "@/types/database";
import {
  criarProcesso,
  type CorretorInput,
  type DocumentoDaParte,
  type NegocioInput,
  type ParteInput,
} from "./actions";
import { consultarConvite, salvarConvite } from "./convites";
import { lerDocumentoRascunho } from "./documentos-rascunho";
import { LinkParteButton } from "../[id]/link-parte-button";
import { atualizarDadosProcesso } from "../[id]/editar/actions";

// Parte de um processo anterior — sugestão pra não redigitar quem já
// apareceu em outro negócio (ex: o mesmo vendedor com dois imóveis).
export type ParteAnterior = Pick<
  ProcessoParte,
  | "nm_parte"
  | "ds_telefone"
  | "ds_email"
  | "ds_profissao"
  | "ds_conta_bancaria"
  | "ds_cpf"
  | "ds_rg"
  | "dt_nascimento"
  | "ds_endereco"
>;

// Papéis livres além de vendedor/comprador — sem checklist de documentos.
// Corretor não entra aqui: quem está nos Honorários já vira parte sozinho.
const OUTROS_PAPEIS: LadoParte[] = ["imobiliaria", "adm", "cliente"];

const TEXTAREA_CLASS =
  "flex min-h-[80px] w-full rounded-radius border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

// Qual dos dois campos (R$ ou %) o usuário digitou por último — o outro
// é calculado a partir dele.
type Base = "valor" | "percentual";

export type CorretorLinha = CorretorInput & { base: Base };

// Estado inicial quando o formulário edita um processo existente.
export type InicialProcessoForm = {
  cd_imobiliaria: string;
  nm_solicitante: string;
  ds_telefone: string;
  vendedores: ParteInput[];
  compradores: ParteInput[];
  outrasPartes: ParteInput[];
  corretores: CorretorLinha[];
  negocio: NegocioInput;
  baseTotal: Base;
  baseImobiliaria: Base;
  imobiliariaParticipa: boolean;
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const arred = (n: number) => String(Math.round(n * 100) / 100);

function derivar(base: Base, valor: string, percentual: string, referencia: number | null) {
  if (base === "valor") {
    const v = num(valor);
    return {
      valor,
      percentual: v !== null && referencia ? arred((v / referencia) * 100) : "",
    };
  }
  const p = num(percentual);
  return {
    valor: p !== null && referencia !== null ? arred((referencia * p) / 100) : "",
    percentual,
  };
}

function Campo({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function SimNao({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      <option value="true">Sim</option>
      <option value="false">Não</option>
    </Select>
  );
}

// Valor calculado (só leitura), com a mesma cara de um campo.
function Calculado({ valor }: { valor: number | null }) {
  return (
    <div className="flex h-9 items-center rounded-radius border border-dashed border-border bg-muted/30 px-3 text-sm text-foreground">
      {valor === null ? <span className="text-muted-foreground">—</span> : formatarMoeda(valor)}
    </div>
  );
}

const parteVazia = (tp_lado: LadoParte, tp_vinculo: VinculoParte | "" = ""): ParteInput => ({
  tp_lado,
  nr_ordem: 0,
  nm_parte: "",
  ds_telefone: "",
  ds_email: "",
  ds_profissao: "",
  ds_conta_bancaria: "",
  ds_documentos_obs: "",
  ds_cpf: "",
  ds_rg: "",
  dt_nascimento: "",
  ds_endereco: "",
  tp_vinculo,
  ds_nire: "",
  ds_tipo_societario: "",
  ds_representacao: "",
  docs: [],
});

const corretorVazio = (): CorretorLinha => ({
  base: "valor",
  cd_corretor: "",
  nm_corretor: "",
  vl_honorario: "",
  pc_honorario: "",
  ds_lado: "",
  ds_cpf: "",
  ds_creci: "",
  ds_pix: "",
  ds_telefone: "",
  ds_email: "",
  dt_nascimento: "",
});

// Preenche só o que ainda está vazio — nunca apaga o que já foi digitado.
function completarComAnterior(parte: ParteInput, anterior: ParteAnterior): Partial<ParteInput> {
  const patch: Partial<ParteInput> = {};
  const campos = [
    "ds_telefone",
    "ds_email",
    "ds_profissao",
    "ds_conta_bancaria",
    "ds_cpf",
    "ds_rg",
    "ds_endereco",
  ] as const;
  for (const campo of campos) {
    if (!parte[campo] && anterior[campo]) patch[campo] = anterior[campo] as string;
  }
  if (!parte.dt_nascimento && anterior.dt_nascimento) {
    patch.dt_nascimento = anterior.dt_nascimento.slice(0, 10);
  }
  return patch;
}

function acharAnterior(nome: string, anteriores: ParteAnterior[]) {
  const alvo = nome.trim().toLowerCase();
  if (!alvo) return null;
  return anteriores.find((p) => p.nm_parte.trim().toLowerCase() === alvo) ?? null;
}

// dd/mm/aaaa -> aaaa-mm-dd (campo date)
function dataParaInput(valor: string | undefined) {
  const m = valor?.match(/(\d{2})[/.-](\d{2})[/.-](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

// O que a leitura do documento preenche na pessoa — só campo vazio.
function aplicarLeituraNaParte(
  parte: ParteInput,
  categoria: CategoriaDocIntake,
  campos: DocumentoDaParte["campos"],
): { patch: Partial<ParteInput>; preenchidos: string[] } {
  const get = (nome: string) => campos.find((c) => c.nm_campo === nome)?.ds_valor?.trim();
  const patch: Partial<ParteInput> = {};
  const preenchidos: string[] = [];
  const usar = (campo: keyof ParteInput, valor: string | undefined, rotulo: string) => {
    if (valor && !parte[campo]) {
      (patch as Record<string, unknown>)[campo] = valor;
      preenchidos.push(rotulo);
    }
  };

  if (categoria === "identidade") {
    usar("nm_parte", get("nome"), "nome");
    usar("ds_cpf", get("cpf"), "CPF");
    usar("ds_rg", get("rg"), "RG");
    usar("dt_nascimento", dataParaInput(get("data_nascimento")), "nascimento");
  }
  if (categoria === "comprovante_residencia") {
    usar("ds_endereco", get("endereco"), "endereço");
  }
  if (categoria === "contrato_social") {
    usar("nm_parte", get("razao_social") ?? get("nome"), "razão social");
    usar("ds_cpf", get("cnpj"), "CNPJ");
    usar("ds_nire", get("nire"), "NIRE");
    usar("ds_tipo_societario", get("tipo_societario"), "tipo societário");
    usar("ds_endereco", get("endereco"), "sede");
  }
  return { patch, preenchidos };
}

type DadosImovelLido = {
  endereco: string | null;
  matricula: string | null;
  inscricaoMunicipal: string | null;
  descricao?: string | null;
  cartorioCodigo: string | null;
  financiado?: boolean | null;
  financiadoMotivo?: string | null;
} | null;

// Botões de anexo: cada arquivo é lido na hora (OCR + IA) e o resultado
// volta pra tela preencher os campos vazios.
function AnexarDocumentos({
  categorias,
  docs,
  onLido,
  onRemover,
}: {
  categorias: CategoriaDocIntake[];
  docs: DocumentoDaParte[];
  // devolve os nomes dos campos que foram preenchidos
  onLido: (doc: DocumentoDaParte, dadosImovel: DadosImovelLido) => string[];
  onRemover: (caminho: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [lendo, setLendo] = useState<CategoriaDocIntake | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const refs = useRef<Partial<Record<CategoriaDocIntake, HTMLInputElement | null>>>({});

  function aoSelecionar(categoria: CategoriaDocIntake, e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setAviso(null);
    setLendo(categoria);
    const fd = new FormData();
    fd.set("arquivo", arquivo);
    fd.set("categoria", categoria);

    startTransition(async () => {
      const r = await lerDocumentoRascunho(fd);
      setLendo(null);
      if (!r.sucesso) {
        setAviso({ ok: false, texto: r.erro });
        return;
      }
      const preenchidos = onLido(
        {
          categoria,
          caminho: r.caminho,
          nome: r.nome,
          tipo: r.tipo,
          confianca: r.confianca,
          campos: r.campos,
        },
        r.dadosImovel,
      );
      setAviso({
        ok: true,
        texto:
          preenchidos.length > 0
            ? `Lido — preencheu: ${preenchidos.join(", ")}.`
            : r.campos.length > 0 || r.dadosImovel
              ? "Lido — nenhum campo vazio pra preencher (o que já estava digitado foi mantido)."
              : "Anexado, mas a leitura não achou dados — preencha à mão.",
      });
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {categorias.map((categoria) => (
          <span key={categoria}>
            <input
              ref={(el) => {
                refs.current[categoria] = el;
              }}
              type="file"
              className="hidden"
              onChange={(e) => aoSelecionar(categoria, e)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={pending}
              onClick={() => refs.current[categoria]?.click()}
            >
              <Paperclip className="h-3.5 w-3.5" />
              {lendo === categoria ? "Lendo o documento..." : CATEGORIA_DOC_INTAKE_LABEL[categoria]}
            </Button>
          </span>
        ))}
      </div>
      {docs.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {docs.map((d) => (
            <li key={d.caminho} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {CATEGORIA_DOC_INTAKE_LABEL[d.categoria]}
              </span>
              <span className="min-w-0 truncate">{d.nome}</span>
              <button
                type="button"
                onClick={() => onRemover(d.caminho)}
                aria-label={`Remover ${d.nome}`}
                className="shrink-0 rounded p-0.5 hover:bg-muted hover:text-status-reprovado"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {aviso && (
        <p className={`text-xs ${aviso.ok ? "text-status-aceito" : "text-status-reprovado"}`}>
          {aviso.texto}
        </p>
      )}
    </div>
  );
}

function OutraParteRow({
  parte,
  anteriores,
  onChange,
  onRemove,
}: {
  parte: ParteInput;
  anteriores: ParteAnterior[];
  onChange: (patch: Partial<ParteInput>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-radius border border-border p-3 sm:grid-cols-2">
      <Campo label="Papel">
        <Select
          value={parte.tp_lado}
          onChange={(e) => onChange({ tp_lado: e.target.value as LadoParte })}
        >
          {OUTROS_PAPEIS.map((papel) => (
            <option key={papel} value={papel}>
              {LADO_PARTE_LABEL[papel]}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo label="Nome">
        <Input
          list="partes-anteriores"
          value={parte.nm_parte}
          onChange={(e) => {
            const anterior = acharAnterior(e.target.value, anteriores);
            onChange({
              nm_parte: e.target.value,
              ...(anterior ? completarComAnterior(parte, anterior) : {}),
            });
          }}
        />
      </Campo>
      <Campo label="Telefone">
        <Input
          type="tel"
          placeholder="(71) 99999-9999"
          value={parte.ds_telefone}
          onChange={(e) => onChange({ ds_telefone: formatarTelefone(e.target.value) })}
        />
      </Campo>
      <Campo label="E-mail">
        <Input
          type="email"
          value={parte.ds_email}
          onChange={(e) => onChange({ ds_email: e.target.value })}
        />
      </Campo>
      <div className="sm:col-span-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remover
        </Button>
      </div>
    </div>
  );
}

function ParteFields({
  parte,
  primeiraEhEmpresa,
  titulo,
  anteriorNome,
  anteriores,
  siteUrl,
  onChange,
  onRemove,
  podeRemover,
  edicao = false,
}: {
  edicao?: boolean;
  parte: ParteInput;
  // o 1º do lado é uma empresa (CNPJ): os seguintes são representantes/sócios
  primeiraEhEmpresa: boolean;
  siteUrl: string | null;
  titulo: string;
  // nome da pessoa anterior do mesmo lado (pro seletor de vínculo)
  anteriorNome: string | null;
  anteriores: ParteAnterior[];
  onChange: (patch: Partial<ParteInput>) => void;
  onRemove: () => void;
  podeRemover: boolean;
}) {
  const [aproveitado, setAproveitado] = useState(false);
  const empresa = anteriorNome === null && tipoDocumentoFiscal(parte.ds_cpf) === "cnpj";
  const [gerandoLink, startLink] = useTransition();
  const [avisoLink, setAvisoLink] = useState<{ ok: boolean; texto: string } | null>(null);

  // Gera o link na hora (ou salva os ajustes de nome/CPF/telefone num link já gerado).
  function gerarOuSalvarLink() {
    setAvisoLink(null);
    startLink(async () => {
      const r = await salvarConvite({
        token: parte.cd_token_parte ?? null,
        lado: parte.tp_lado === "comprador" ? "comprador" : "vendedor",
        nome: parte.nm_parte,
        cpf: parte.ds_cpf,
        telefone: parte.ds_telefone,
      });
      if (!r.sucesso) {
        setAvisoLink({ ok: false, texto: r.erro });
        return;
      }
      onChange({ cd_token_parte: r.token });
      setAvisoLink({
        ok: true,
        texto: parte.cd_token_parte
          ? "Alterações salvas no link."
          : "Link gerado — já está funcionando. Pode enviar ao cliente.",
      });
    });
  }

  // O que o cliente já preencheu/enviou: mostra e completa só os campos vazios aqui.
  function verRetornoDoCliente() {
    if (!parte.cd_token_parte) return;
    setAvisoLink(null);
    startLink(async () => {
      const r = await consultarConvite(parte.cd_token_parte as string);
      if (!r.sucesso) {
        setAvisoLink({ ok: false, texto: r.erro });
        return;
      }
      const d = r.dados;
      const patch: Partial<ParteInput> = {};
      const vazio = (v: string) => !v.trim();
      if (d.nm_parte && vazio(parte.nm_parte)) patch.nm_parte = d.nm_parte;
      if (d.ds_cpf && vazio(parte.ds_cpf)) patch.ds_cpf = d.ds_cpf;
      if (d.ds_rg && vazio(parte.ds_rg)) patch.ds_rg = d.ds_rg;
      if (d.dt_nascimento && !parte.dt_nascimento)
        patch.dt_nascimento = d.dt_nascimento.slice(0, 10);
      if (d.ds_telefone && vazio(parte.ds_telefone)) patch.ds_telefone = d.ds_telefone;
      if (d.ds_email && vazio(parte.ds_email)) patch.ds_email = d.ds_email;
      if (d.ds_profissao && vazio(parte.ds_profissao)) patch.ds_profissao = d.ds_profissao;
      if (d.ds_endereco && vazio(parte.ds_endereco)) patch.ds_endereco = d.ds_endereco;
      if (Object.keys(patch).length > 0) onChange(patch);

      const preencheu = [d.nm_parte, d.ds_rg, d.ds_profissao, d.ds_endereco].some(Boolean);
      setAvisoLink({
        ok: true,
        texto:
          r.documentos.length === 0 && !preencheu
            ? "O cliente ainda não preencheu nem enviou nada."
            : `O cliente já enviou ${r.documentos.length} documento(s)${preencheu ? " e preencheu dados" : ""}. Tudo entra no processo ao clicar em Criar processo.`,
      });
    });
  }

  function trocarNome(nome: string) {
    const anterior = acharAnterior(nome, anteriores);
    const patch = anterior ? completarComAnterior(parte, anterior) : {};
    setAproveitado(Object.keys(patch).length > 0);
    onChange({ nm_parte: nome, ...patch });
  }

  return (
    <div className="flex flex-col gap-3 rounded-radius border border-border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{titulo}</span>
        {podeRemover && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label="Remover"
            className="h-7 w-7"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {anteriorNome !== null && (
        <Campo label={`Vínculo com ${anteriorNome.trim() || "a pessoa anterior"}`}>
          <Select
            value={parte.tp_vinculo || (primeiraEhEmpresa ? "representante" : "conjuge")}
            onChange={(e) => onChange({ tp_vinculo: e.target.value as VinculoParte })}
          >
            {(
              (primeiraEhEmpresa
                ? ["representante", "anuente", "outro"]
                : ["conjuge", "companheiro", "anuente", "outro"]) as VinculoParte[]
            ).map((v) => (
              <option key={v} value={v}>
                {VINCULO_PARTE_LABEL[v]}
              </option>
            ))}
          </Select>
          <span className="text-xs text-muted-foreground">
            {primeiraEhEmpresa && (parte.tp_vinculo || "representante") === "representante"
              ? 'Sócio-administrador: assina pela empresa e é qualificado no contrato ("neste ato representada por...").'
              : primeiraEhEmpresa && parte.tp_vinculo === "anuente"
                ? 'Sócio anuente: entra no contrato como "com a expressa anuência de seus demais sócios".'
                : (parte.tp_vinculo || "conjuge") === "conjuge"
                  ? "Certidão de casamento e comprovante de endereço valem pros dois — não precisa anexar duas vezes."
                  : parte.tp_vinculo === "companheiro"
                    ? "Cada um manda a própria certidão de estado civil; comprovante de endereço e declaração de união estável valem pros dois."
                    : parte.tp_vinculo === "anuente"
                      ? "Anuente: consente no negócio (ex: cônjuge que não é parte, herdeiro). Entra no contrato como anuente e manda os próprios documentos."
                      : "Pessoa independente: manda todos os documentos dela."}
          </span>
        </Campo>
      )}

      {!parte.modo && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">Como você quer cadastrar esta pessoa?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onChange({ modo: "manual" })}
              className="flex flex-col items-start gap-1.5 rounded-radius border border-border p-4 text-left transition-colors hover:border-brand hover:bg-muted/40"
            >
              <PenLine className="h-5 w-5 text-accent" />
              <span className="text-sm font-medium text-foreground">Preencher aqui</span>
              <span className="text-xs text-muted-foreground">
                Você digita os dados e/ou anexa os documentos (o sistema lê e preenche).
              </span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ modo: "link" })}
              className="flex flex-col items-start gap-1.5 rounded-radius border border-border p-4 text-left transition-colors hover:border-brand hover:bg-muted/40"
            >
              <Link2 className="h-5 w-5 text-accent" />
              <span className="text-sm font-medium text-foreground">Gerar link para o cliente</span>
              <span className="text-xs text-muted-foreground">
                O próprio cliente anexa os documentos e preenche os dados, numa página segura.
              </span>
            </button>
          </div>
        </div>
      )}

      {parte.modo && !edicao && (
        <button
          type="button"
          onClick={() => onChange({ modo: undefined, cd_token_parte: undefined })}
          className="w-fit text-xs text-muted-foreground underline"
        >
          ← escolher outra forma de cadastro
        </button>
      )}

      {parte.modo === "link" && (
        <div className="flex flex-col gap-3 rounded-radius border border-border bg-muted/20 p-4">
          <p className="text-sm font-medium text-foreground">Link para o cliente preencher</p>
          <p className="text-xs text-muted-foreground">
            O cliente abre o link, confere os dados, anexa os documentos e a leitura preenche o
            resto. A página explica a ele como os dados são protegidos. Se você já souber, preencha
            abaixo o que quiser deixar pronto antes de enviar — o cliente vê esses dados já
            preenchidos e só confere.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Nome completo" className="sm:col-span-2">
              <Input
                list="partes-anteriores"
                value={parte.nm_parte}
                placeholder="Se ficar em branco, o cliente preenche"
                onChange={(e) => trocarNome(e.target.value)}
              />
              {aproveitado && (
                <span className="text-xs text-status-aceito">
                  Dados preenchidos a partir de um processo anterior — confira.
                </span>
              )}
            </Campo>
            <DocumentoFiscalInput
              value={parte.ds_cpf}
              placeholder="Se ficar em branco, o cliente preenche"
              onChange={(v) => onChange({ ds_cpf: v })}
            />
            <Campo label="Telefone (pra enviar no WhatsApp)">
              <Input
                type="tel"
                placeholder="(71) 99999-9999"
                value={parte.ds_telefone}
                onChange={(e) => onChange({ ds_telefone: formatarTelefone(e.target.value) })}
              />
            </Campo>
          </div>
          {!siteUrl ? (
            <p className="text-xs text-status-reprovado">
              Endereço do site não configurado (NEXT_PUBLIC_SITE_URL) — não dá pra montar o link.
            </p>
          ) : !parte.cd_token_parte ? (
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                className="w-fit gap-1.5"
                disabled={gerandoLink}
                onClick={gerarOuSalvarLink}
              >
                <Link2 className="h-4 w-4" />
                {gerandoLink ? "Gerando..." : "Gerar link"}
              </Button>
              <p className="text-xs text-muted-foreground">
                O link fica pronto na hora e já funciona — mesmo antes de você criar o processo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-radius border border-dashed border-border bg-card p-3">
              <p className="break-all font-mono text-xs text-foreground">
                {siteUrl}/parte/{parte.cd_token_parte}
              </p>
              <LinkParteButton
                link={`${siteUrl}/parte/${parte.cd_token_parte}`}
                telefone={parte.ds_telefone}
                nome={parte.nm_parte}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={gerandoLink}
                  onClick={gerarOuSalvarLink}
                >
                  Salvar alterações no link
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={gerandoLink}
                  onClick={verRetornoDoCliente}
                >
                  Ver o que o cliente já enviou
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tudo o que o cliente preencher e anexar fica guardado e entra no processo quando
                você clicar em <strong>Criar processo</strong>.
              </p>
            </div>
          )}
          {avisoLink && (
            <p
              className={`text-xs ${avisoLink.ok ? "text-status-aceito" : "text-status-reprovado"}`}
            >
              {avisoLink.texto}
            </p>
          )}
        </div>
      )}

      {parte.modo === "manual" && (
        <>
          {!edicao && (
          <div className="rounded-radius border border-dashed border-border p-3">
            <p className="mb-2 text-xs text-muted-foreground">
              Anexe os documentos da pessoa — o sistema lê e preenche nome, CPF, RG, nascimento e
              endereço que estiverem em branco. Os arquivos já ficam no processo.
            </p>
            <AnexarDocumentos
              categorias={empresa ? CATEGORIAS_DOC_EMPRESA : CATEGORIAS_DOC_PESSOAIS}
              docs={parte.docs ?? []}
              onLido={(doc) => {
                const { patch, preenchidos } = aplicarLeituraNaParte(
                  parte,
                  doc.categoria,
                  doc.campos,
                );
                onChange({ ...patch, docs: [...(parte.docs ?? []), doc] });
                return preenchidos;
              }}
              onRemover={(caminho) =>
                onChange({
                  docs: (parte.docs ?? []).filter((d) => d.caminho !== caminho),
                })
              }
            />
          </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label={empresa ? "Razão social" : "Nome"} className="sm:col-span-2">
              <Input
                list="partes-anteriores"
                placeholder="Digite o nome completo — se já participou de outro processo, os dados vêm sozinhos"
                value={parte.nm_parte}
                onChange={(e) => trocarNome(e.target.value)}
              />
              {aproveitado && (
                <span className="text-xs text-status-aceito">
                  Dados preenchidos a partir de um processo anterior — confira.
                </span>
              )}
            </Campo>
            <DocumentoFiscalInput value={parte.ds_cpf} onChange={(v) => onChange({ ds_cpf: v })} />
            {empresa && (
              <>
                <Campo label="NIRE">
                  <Input
                    value={parte.ds_nire}
                    onChange={(e) => onChange({ ds_nire: e.target.value })}
                  />
                </Campo>
                <Campo label="Tipo societário">
                  <Input
                    list="tipos-societarios"
                    placeholder="Ex: sociedade empresária limitada"
                    value={parte.ds_tipo_societario}
                    onChange={(e) => onChange({ ds_tipo_societario: e.target.value })}
                  />
                  <datalist id="tipos-societarios">
                    <option value="sociedade empresária limitada" />
                    <option value="sociedade anônima" />
                    <option value="empresa individual de responsabilidade limitada" />
                    <option value="sociedade simples" />
                  </datalist>
                </Campo>
                <Campo label="Como a empresa é representada" className="sm:col-span-2">
                  <Select
                    value={parte.ds_representacao || "conjunta"}
                    onChange={(e) =>
                      onChange({ ds_representacao: e.target.value as "conjunta" | "isolada" })
                    }
                  >
                    <option value="conjunta">Em conjunto (todos os administradores assinam)</option>
                    <option value="isolada">Isoladamente (qualquer administrador assina)</option>
                  </Select>
                  <span className="text-xs text-muted-foreground">
                    Depois, em <strong>Adicionar vendedor</strong>, cadastre cada
                    sócio-administrador (representante) e cada sócio anuente.
                  </span>
                </Campo>
              </>
            )}
            {!empresa && (
              <Campo label="RG">
                <Input value={parte.ds_rg} onChange={(e) => onChange({ ds_rg: e.target.value })} />
              </Campo>
            )}
            {!empresa && (
              <Campo label="Data de nascimento">
                <Input
                  type="date"
                  value={parte.dt_nascimento}
                  onChange={(e) => onChange({ dt_nascimento: e.target.value })}
                />
              </Campo>
            )}
            {!empresa && (
              <Campo label="Profissão">
                <Input
                  value={parte.ds_profissao}
                  onChange={(e) => onChange({ ds_profissao: e.target.value })}
                />
              </Campo>
            )}
            <Campo label="Telefone">
              <Input
                type="tel"
                placeholder="(71) 99999-9999"
                value={parte.ds_telefone}
                onChange={(e) => onChange({ ds_telefone: formatarTelefone(e.target.value) })}
              />
            </Campo>
            <Campo label="E-mail">
              <Input
                type="email"
                value={parte.ds_email}
                onChange={(e) => onChange({ ds_email: e.target.value })}
              />
            </Campo>
            <Campo
              label={empresa ? "Sede (endereço da empresa)" : "Endereço"}
              className="sm:col-span-2"
            >
              <Input
                placeholder="Rua, número, bairro, cidade/UF"
                value={parte.ds_endereco}
                onChange={(e) => onChange({ ds_endereco: e.target.value })}
              />
            </Campo>
            <Campo label="Conta bancária" className="sm:col-span-2">
              <Input
                placeholder="Banco, agência e conta"
                value={parte.ds_conta_bancaria}
                onChange={(e) => onChange({ ds_conta_bancaria: e.target.value })}
              />
            </Campo>
            <Campo label="Observações sobre os documentos" className="sm:col-span-2">
              <textarea
                className={TEXTAREA_CLASS}
                value={parte.ds_documentos_obs}
                onChange={(e) => onChange({ ds_documentos_obs: e.target.value })}
              />
            </Campo>
          </div>
        </>
      )}

      {parte.modo === "manual" && (
        <p className="text-xs text-muted-foreground">
          Os documentos anexados acima já vão pro processo, no item certo do checklist. Em casal,
          anexe a certidão de casamento e o comprovante de endereço só uma vez (na primeira pessoa).
          Também dá pra anexar depois, na tela do processo, ou a própria pessoa pelo link.
        </p>
      )}
    </div>
  );
}

function CorretorRow({
  corretor,
  exibido,
  cadastro,
  onChange,
  onRemove,
}: {
  corretor: CorretorLinha;
  exibido: { valor: string; percentual: string };
  cadastro: Corretor[];
  onChange: (patch: Partial<CorretorLinha>) => void;
  onRemove: () => void;
}) {
  const doCadastro = corretor.cd_corretor
    ? (cadastro.find((c) => c.cd_corretor === corretor.cd_corretor) ?? null)
    : null;

  function trocarNome(nome: string) {
    const achado = cadastro.find(
      (c) => c.nm_corretor.trim().toLowerCase() === nome.trim().toLowerCase(),
    );
    onChange({ nm_corretor: nome, cd_corretor: achado?.cd_corretor ?? "" });
  }

  const resumoCadastro = doCadastro
    ? [
        doCadastro.ds_cpf && `CPF ${doCadastro.ds_cpf}`,
        doCadastro.ds_creci && `CRECI ${doCadastro.ds_creci}`,
        doCadastro.ds_pix && `PIX ${doCadastro.ds_pix}`,
        doCadastro.dt_nascimento &&
          `nascimento ${doCadastro.dt_nascimento.slice(0, 10).split("-").reverse().join("/")}`,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="flex flex-col gap-2 rounded-radius border border-border p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_9rem_6.5rem_auto]">
        <Campo label="Corretor">
          <Input
            list="corretores-cadastro"
            placeholder="Digite ou escolha do cadastro"
            value={corretor.nm_corretor}
            onChange={(e) => trocarNome(e.target.value)}
          />
        </Campo>
        <Campo label="Honorário (R$)">
          <CurrencyInput
            value={exibido.valor}
            onChange={(v) => onChange({ vl_honorario: v, base: "valor" })}
          />
        </Campo>
        <Campo label="% dos honorários">
          <PercentInput
            value={exibido.percentual}
            onChange={(v) => onChange({ pc_honorario: v, base: "percentual" })}
          />
        </Campo>
        <div className="flex items-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            aria-label="Remover corretor"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {doCadastro ? (
        <p className="text-xs text-muted-foreground">
          Do cadastro de corretores{resumoCadastro ? `: ${resumoCadastro}` : ""}. Pra corrigir,
          edite em Configurações → Corretores.
        </p>
      ) : (
        corretor.nm_corretor.trim() && (
          <details className="rounded-radius border border-dashed border-border px-3 py-2" open>
            <summary className="cursor-pointer text-xs text-foreground">
              Corretor novo — dados pro cadastro
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="CPF">
                <Input
                  value={corretor.ds_cpf}
                  onChange={(e) => onChange({ ds_cpf: e.target.value })}
                />
              </Campo>
              <Campo label="Data de nascimento">
                <Input
                  type="date"
                  value={corretor.dt_nascimento}
                  onChange={(e) => onChange({ dt_nascimento: e.target.value })}
                />
              </Campo>
              <Campo label="CRECI (só o número)">
                <Input
                  value={corretor.ds_creci}
                  onChange={(e) => onChange({ ds_creci: e.target.value })}
                />
              </Campo>
              <Campo label="Chave PIX">
                <Input
                  value={corretor.ds_pix}
                  onChange={(e) => onChange({ ds_pix: e.target.value })}
                />
              </Campo>
              <Campo label="Telefone">
                <Input
                  type="tel"
                  placeholder="(71) 99999-9999"
                  value={corretor.ds_telefone}
                  onChange={(e) => onChange({ ds_telefone: formatarTelefone(e.target.value) })}
                />
              </Campo>
              <Campo label="E-mail">
                <Input
                  type="email"
                  value={corretor.ds_email}
                  onChange={(e) => onChange({ ds_email: e.target.value })}
                />
              </Campo>
            </div>
          </details>
        )
      )}
    </div>
  );
}

export function ProcessoForm({
  imobiliarias,
  corretoresCadastro,
  partesAnteriores,
  siteUrl,
  edicao,
}: {
  // Preenchido na tela de edição (/processos/[id]/editar)
  edicao?: { cdProcesso: string; inicial: InicialProcessoForm };
  imobiliarias: Imobiliaria[];
  corretoresCadastro: Corretor[];
  partesAnteriores: ParteAnterior[];
  siteUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  // Imobiliária é opcional — venda sem imobiliária (só corretores).
  const [cdImobiliaria, setCdImobiliaria] = useState(edicao?.inicial.cd_imobiliaria ?? "");
  const [nmSolicitante, setNmSolicitante] = useState(edicao?.inicial.nm_solicitante ?? "");
  const [dsTelefone, setDsTelefone] = useState(edicao?.inicial.ds_telefone ?? "");

  const [vendedores, setVendedores] = useState<ParteInput[]>(
    edicao?.inicial.vendedores ?? [parteVazia("vendedor")],
  );
  const [compradores, setCompradores] = useState<ParteInput[]>(
    edicao?.inicial.compradores ?? [parteVazia("comprador")],
  );
  const [outrasPartes, setOutrasPartes] = useState<ParteInput[]>(
    edicao?.inicial.outrasPartes ?? [],
  );
  const [corretores, setCorretores] = useState<CorretorLinha[]>(
    edicao?.inicial.corretores ?? [],
  );
  const [docsImovel, setDocsImovel] = useState<DocumentoDaParte[]>([]);
  const [baseTotal, setBaseTotal] = useState<Base>(
    edicao?.inicial.baseTotal ?? "valor",
  );
  const [baseImobiliaria, setBaseImobiliaria] = useState<Base>(
    edicao?.inicial.baseImobiliaria ?? "valor",
  );
  const [imobiliariaParticipa, setImobiliariaParticipa] = useState(
    edicao?.inicial.imobiliariaParticipa ?? false,
  );

  const [negocio, setNegocio] = useState<NegocioInput>(
    edicao?.inicial.negocio ?? {
    vl_imovel: "",
    vl_entrada: "",
    vl_financiamento: "",
    ds_banco: "",
    sn_possui_inquilino: "",
    sn_ocupado: "",
    ds_entrega_chaves: "",
    ds_itens_imovel: "",
    sn_imovel_financiado: "",
    ds_prazo_financiamento: "",
    ds_imovel_endereco: "",
    ds_imovel_matricula: "",
    ds_imovel_iptu: "",
    ds_imovel_descricao: "",
    ds_imovel_cartorio: "",
    tp_pagamento: "",
    vl_sinal: "",
    sn_usa_fgts: "",
    vl_fgts: "",
    vl_saldo_quitacao: "",
    vl_honorarios_total: "",
    pc_honorarios_total: "",
    ds_honorarios_quando: "",
    vl_honorarios_imobiliaria: "",
    pc_honorarios_imobiliaria: "",
  },
  );

  // O que a IA viu na matrícula sobre financiamento/hipoteca (mostrado ao lado do campo).
  const [motivoOnus, setMotivoOnus] = useState<string | null>(null);

  function patchNegocio(patch: Partial<NegocioInput>) {
    setNegocio((n) => ({ ...n, ...patch }));
  }

  function patchParte(
    lista: ParteInput[],
    setLista: (v: ParteInput[]) => void,
    idx: number,
    patch: Partial<ParteInput>,
  ) {
    setLista(lista.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function patchCorretor(idx: number, patch: Partial<CorretorLinha>) {
    setCorretores((lista) => lista.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  // Pagamento: saldo = valor − sinal − entrada. Financiado: é o saldo
  // financiado (inclui o FGTS, se usar). À vista: saldo pra quitação.
  const vlImovel = num(negocio.vl_imovel);
  const saldo =
    vlImovel === null
      ? null
      : Math.max(
          0,
          Math.round(
            (vlImovel - (num(negocio.vl_sinal) ?? 0) - (num(negocio.vl_entrada) ?? 0)) * 100,
          ) / 100,
        );

  // Honorários: total em R$ ou % do imóvel; imobiliária e corretores em
  // R$ ou % do total. O campo digitado por último manda.
  const total = derivar(
    baseTotal,
    negocio.vl_honorarios_total,
    negocio.pc_honorarios_total,
    vlImovel,
  );
  const totalNum = num(total.valor);
  const imobiliaria = imobiliariaParticipa
    ? derivar(
        baseImobiliaria,
        negocio.vl_honorarios_imobiliaria,
        negocio.pc_honorarios_imobiliaria,
        totalNum,
      )
    : { valor: "", percentual: "" };
  const corretoresExibidos = corretores.map((c) =>
    derivar(c.base, c.vl_honorario, c.pc_honorario, totalNum),
  );

  const temDistribuicao =
    imobiliaria.valor !== "" || corretoresExibidos.some((c) => c.valor !== "");
  const distribuido =
    (num(imobiliaria.valor) ?? 0) +
    corretoresExibidos.reduce((soma, c) => soma + (num(c.valor) ?? 0), 0);
  const diferenca =
    totalNum !== null && temDistribuicao ? Math.round((totalNum - distribuido) * 100) / 100 : 0;

  function salvar() {
    setErro(null);
    if (!nmSolicitante.trim()) {
      setErro("Informe quem solicitou o contrato.");
      return;
    }

    const comNomeProvisorio = (p: ParteInput, rotulo: string, i: number): ParteInput =>
      p.modo === "link" && !p.nm_parte.trim()
        ? { ...p, nm_parte: `${rotulo} ${i + 1} — aguardando preenchimento` }
        : p;

    const partes: ParteInput[] = [
      ...vendedores.map((pOrig, i) => {
        const p = comNomeProvisorio(pOrig, "Vendedor", i);
        return {
          ...p,
          tp_lado: "vendedor" as const,
          nr_ordem: i,
          tp_vinculo:
            i === 0
              ? ("" as const)
              : p.tp_vinculo ||
                (tipoDocumentoFiscal(vendedores[0].ds_cpf) === "cnpj"
                  ? ("representante" as const)
                  : ("conjuge" as const)),
        };
      }),
      ...compradores.map((pOrig, i) => {
        const p = comNomeProvisorio(pOrig, "Comprador", i);
        return {
          ...p,
          tp_lado: "comprador" as const,
          nr_ordem: i,
          tp_vinculo:
            i === 0
              ? ("" as const)
              : p.tp_vinculo ||
                (tipoDocumentoFiscal(compradores[0].ds_cpf) === "cnpj"
                  ? ("representante" as const)
                  : ("conjuge" as const)),
        };
      }),
      ...outrasPartes.map((p, i) => ({
        ...p,
        nr_ordem: i,
        tp_vinculo: "" as const,
      })),
    ].filter((p) => p.nm_parte.trim());

    const corretoresFinal: CorretorInput[] = corretores
      .map((c, i) => ({
        cd_corretor: c.cd_corretor,
        nm_corretor: c.nm_corretor,
        vl_honorario: corretoresExibidos[i].valor,
        pc_honorario: corretoresExibidos[i].percentual,
        ds_lado: c.ds_lado,
        ds_cpf: c.ds_cpf,
        ds_creci: c.ds_creci,
        ds_pix: c.ds_pix,
        ds_telefone: c.ds_telefone,
        ds_email: c.ds_email,
        dt_nascimento: c.dt_nascimento,
      }))
      .filter((c) => c.nm_corretor.trim());

    const financiado = negocio.tp_pagamento === "financiado";
    const aVista = negocio.tp_pagamento === "a_vista";

    startTransition(async () => {
      const payload = {
        cd_imobiliaria: cdImobiliaria,
        nm_comprador_convidado: nmSolicitante.trim(),
        ds_telefone_comprador_convidado: dsTelefone,
        negocio: {
          ...negocio,
          vl_financiamento: financiado && saldo !== null ? String(saldo) : "",
          vl_saldo_quitacao: aVista && saldo !== null ? String(saldo) : "",
          sn_usa_fgts: financiado ? negocio.sn_usa_fgts : "",
          vl_fgts: financiado && negocio.sn_usa_fgts === "true" ? negocio.vl_fgts : "",
          ds_banco: financiado ? negocio.ds_banco : "",
          vl_honorarios_total: total.valor,
          pc_honorarios_total: total.percentual,
          vl_honorarios_imobiliaria: imobiliaria.valor,
          pc_honorarios_imobiliaria: imobiliaria.percentual,
        },
        partes,
        corretores: corretoresFinal,
        documentos_imovel: docsImovel,
      };
      const resultado = edicao
        ? await atualizarDadosProcesso(edicao.cdProcesso, payload)
        : await criarProcesso(payload);
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  function cardPartes(
    titulo: string,
    lado: "vendedor" | "comprador",
    lista: ParteInput[],
    setLista: (v: ParteInput[]) => void,
  ) {
    const rotulo = lado === "vendedor" ? "Vendedor" : "Comprador";
    return (
      <Card>
        <CardHeader>
          <CardTitle>{titulo}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {lista.map((parte, idx) => (
            <ParteFields
              key={idx}
              parte={parte}
              titulo={idx === 0 ? rotulo : `${rotulo} ${idx + 1}`}
              primeiraEhEmpresa={tipoDocumentoFiscal(lista[0].ds_cpf) === "cnpj"}
              anteriorNome={idx === 0 ? null : lista[idx - 1].nm_parte}
              anteriores={partesAnteriores}
              siteUrl={siteUrl}
              podeRemover={lista.length > 1}
              edicao={!!edicao}
              onChange={(patch) => patchParte(lista, setLista, idx, patch)}
              onRemove={() => setLista(lista.filter((_, i) => i !== idx))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={() =>
              setLista([
                ...lista,
                { ...parteVazia(lado, "conjuge"), ...(edicao ? { modo: "manual" as const } : {}) },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Adicionar {lado === "vendedor" ? "vendedor" : "comprador"} (cônjuge, companheiro ou
            outra pessoa)
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {edicao && (
        <p className="rounded-radius border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Os documentos já anexados e os links dos clientes continuam como estão. Se este processo já
          tem minuta, gere uma nova versão depois de salvar para refletir as mudanças.
        </p>
      )}
      <datalist id="partes-anteriores">
        {partesAnteriores.map((p) => (
          <option key={p.nm_parte} value={p.nm_parte} />
        ))}
      </datalist>

      <Card>
        <CardHeader>
          <CardTitle>Dados do processo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Imobiliária (se houver)" htmlFor="cd_imobiliaria">
            <Select
              id="cd_imobiliaria"
              value={cdImobiliaria}
              onChange={(e) => {
                setCdImobiliaria(e.target.value);
                if (!e.target.value) setImobiliariaParticipa(false);
              }}
            >
              <option value="">— Sem imobiliária —</option>
              {imobiliarias.map((imob) => (
                <option key={imob.cd_imobiliaria} value={imob.cd_imobiliaria}>
                  {imob.nm_imobiliaria}
                </option>
              ))}
            </Select>
          </Campo>
          <div className="hidden sm:block" />
          <Campo label="Quem solicitou o contrato" htmlFor="nm_solicitante">
            <Input
              id="nm_solicitante"
              placeholder="Corretor, imobiliária ou cliente que pediu"
              value={nmSolicitante}
              onChange={(e) => setNmSolicitante(e.target.value)}
            />
          </Campo>
          <Campo label="Telefone de quem solicitou" htmlFor="ds_telefone">
            <Input
              id="ds_telefone"
              type="tel"
              placeholder="(71) 99999-9999"
              value={dsTelefone}
              onChange={(e) => setDsTelefone(formatarTelefone(e.target.value))}
            />
          </Campo>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            O solicitante só identifica o processo na lista — não entra no contrato. Vendedores e
            compradores são cadastrados abaixo.
          </p>
        </CardContent>
      </Card>

      {cardPartes("Vendedores", "vendedor", vendedores, setVendedores)}
      {cardPartes("Compradores", "comprador", compradores, setCompradores)}

      <Card>
        <CardHeader>
          <CardTitle>Outras partes</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Imobiliária, administrador, cliente... Cada um recebe um link próprio pra preencher os
            dados e anexar documentos. Corretores não precisam ser lançados aqui — quem está nos
            Honorários entra como parte automaticamente.
          </p>
          {outrasPartes.map((parte, idx) => (
            <OutraParteRow
              key={idx}
              parte={parte}
              anteriores={partesAnteriores}
              onChange={(patch) => patchParte(outrasPartes, setOutrasPartes, idx, patch)}
              onRemove={() => setOutrasPartes(outrasPartes.filter((_, i) => i !== idx))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={() => setOutrasPartes([...outrasPartes, parteVazia("imobiliaria")])}
          >
            <Plus className="h-4 w-4" />
            Adicionar parte
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Imóvel</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!edicao && (
          <div className="rounded-radius border border-dashed border-border p-3 sm:col-span-2">
            <p className="mb-2 text-xs text-muted-foreground">
              Anexe a certidão de ônus/escritura e o IPTU — o sistema lê e preenche endereço,
              matrícula, inscrição municipal e cartório que estiverem em branco. Um conjunto só pro
              imóvel, não um por vendedor.
            </p>
            <AnexarDocumentos
              categorias={CATEGORIAS_DOC_IMOVEL}
              docs={docsImovel}
              onLido={(doc, dados) => {
                setDocsImovel((lista) => [...lista, doc]);
                const preenchidos: string[] = [];
                const patch: Partial<NegocioInput> = {};
                if (dados?.endereco && !negocio.ds_imovel_endereco) {
                  patch.ds_imovel_endereco = dados.endereco;
                  preenchidos.push("endereço");
                }
                if (dados?.matricula && !negocio.ds_imovel_matricula) {
                  patch.ds_imovel_matricula = dados.matricula;
                  preenchidos.push("matrícula");
                }
                if (dados?.inscricaoMunicipal && !negocio.ds_imovel_iptu) {
                  patch.ds_imovel_iptu = dados.inscricaoMunicipal;
                  preenchidos.push("inscrição municipal");
                }
                if (dados?.descricao && !negocio.ds_imovel_descricao) {
                  patch.ds_imovel_descricao = dados.descricao;
                  preenchidos.push("descrição do imóvel");
                }
                if (dados?.cartorioCodigo && !negocio.ds_imovel_cartorio) {
                  patch.ds_imovel_cartorio = dados.cartorioCodigo;
                  preenchidos.push("cartório");
                }
                if (typeof dados?.financiado === "boolean" && !negocio.sn_imovel_financiado) {
                  patch.sn_imovel_financiado = String(dados.financiado);
                  preenchidos.push("financiamento do imóvel");
                  setMotivoOnus(dados.financiadoMotivo ?? null);
                }
                if (preenchidos.length > 0) patchNegocio(patch);
                return preenchidos;
              }}
              onRemover={(caminho) =>
                setDocsImovel((lista) => lista.filter((d) => d.caminho !== caminho))
              }
            />
          </div>
          )}
          <Campo label="Endereço do imóvel" className="sm:col-span-2">
            <Input
              placeholder="Rua, número, complemento, bairro, cidade/UF"
              value={negocio.ds_imovel_endereco}
              onChange={(e) => patchNegocio({ ds_imovel_endereco: e.target.value })}
            />
          </Campo>
          <Campo label="Descrição do imóvel (como na matrícula)" className="sm:col-span-2">
            <textarea
              rows={4}
              className="w-full rounded-radius border border-border bg-background px-3 py-2 text-sm"
              placeholder="APARTAMENTO de nº … , com área privativa de …, fração ideal de …"
              value={negocio.ds_imovel_descricao}
              onChange={(e) => patchNegocio({ ds_imovel_descricao: e.target.value })}
            />
          </Campo>
          <Campo label="Matrícula">
            <Input
              value={negocio.ds_imovel_matricula}
              onChange={(e) => patchNegocio({ ds_imovel_matricula: e.target.value })}
            />
          </Campo>
          <Campo label="Inscrição municipal (IPTU)">
            <Input
              value={negocio.ds_imovel_iptu}
              onChange={(e) => patchNegocio({ ds_imovel_iptu: e.target.value })}
            />
          </Campo>
          <Campo label="Cartório de registro de imóveis" className="sm:col-span-2">
            <Select
              value={negocio.ds_imovel_cartorio}
              onChange={(e) => patchNegocio({ ds_imovel_cartorio: e.target.value })}
            >
              <option value="">—</option>
              {CARTORIOS_IMOVEIS.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.rotulo}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Possui inquilino?">
            <SimNao
              value={negocio.sn_possui_inquilino}
              onChange={(v) => patchNegocio({ sn_possui_inquilino: v })}
            />
          </Campo>
          <Campo label="Está ocupado?">
            <SimNao value={negocio.sn_ocupado} onChange={(v) => patchNegocio({ sn_ocupado: v })} />
          </Campo>
          <Campo label="Prazo de entrega das chaves (após a quitação)" className="sm:col-span-2">
            <Input
              placeholder="Ex: 24 (vinte e quatro) horas corridas"
              value={negocio.ds_entrega_chaves}
              onChange={(e) => patchNegocio({ ds_entrega_chaves: e.target.value })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Entra na cláusula sexta: &quot;no prazo máximo de … APÓS a quitação do valor total&quot;.
            </p>
          </Campo>
          <Campo label="Imóvel com financiamento/hipoteca em aberto?" className="sm:col-span-2">
            <SimNao
              value={negocio.sn_imovel_financiado}
              onChange={(v) => patchNegocio({ sn_imovel_financiado: v })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {motivoOnus
                ? `Lido da matrícula: ${motivoOnus} `
                : "Preenchido pela leitura da matrícula. "}
              &quot;Sim&quot; ou em branco mantém &quot;EXCETO FINANCIAMENTO&quot; na cláusula quarta;
              &quot;Não&quot; tira.
            </p>
          </Campo>
          <Campo label="Prazo para assinar o contrato de financiamento (3.2)" className="sm:col-span-2">
            <Input
              placeholder="60 (sessenta) dias corridos"
              value={negocio.ds_prazo_financiamento}
              onChange={(e) => patchNegocio({ ds_prazo_financiamento: e.target.value })}
            />
          </Campo>
          <Campo label="O que fica no imóvel (por cômodo)" className="sm:col-span-2">
            <textarea
              className={TEXTAREA_CLASS}
              placeholder="Ex: armários embutidos nos 2 quartos. Em branco = entregue vazio."
              value={negocio.ds_itens_imovel}
              onChange={(e) => patchNegocio({ ds_itens_imovel: e.target.value })}
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valores e pagamento</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Valor do imóvel">
            <CurrencyInput
              value={negocio.vl_imovel}
              onChange={(v) => patchNegocio({ vl_imovel: v })}
            />
          </Campo>
          <Campo label="Forma de pagamento">
            <Select
              value={negocio.tp_pagamento}
              onChange={(e) =>
                patchNegocio({
                  tp_pagamento: e.target.value as NegocioInput["tp_pagamento"],
                })
              }
            >
              <option value="">—</option>
              <option value="financiado">Financiado</option>
              <option value="a_vista">À vista</option>
            </Select>
          </Campo>
          <Campo label="Sinal">
            <CurrencyInput
              value={negocio.vl_sinal}
              onChange={(v) => patchNegocio({ vl_sinal: v })}
            />
          </Campo>
          <Campo label="Entrada">
            <CurrencyInput
              value={negocio.vl_entrada}
              onChange={(v) => patchNegocio({ vl_entrada: v })}
            />
          </Campo>

          {negocio.tp_pagamento === "financiado" && (
            <>
              <Campo label="Saldo financiado (calculado)">
                <Calculado valor={saldo} />
              </Campo>
              <Campo label="Qual banco">
                <Input
                  value={negocio.ds_banco}
                  onChange={(e) => patchNegocio({ ds_banco: e.target.value })}
                />
              </Campo>
              <Campo label="O comprador vai usar FGTS?">
                <SimNao
                  value={negocio.sn_usa_fgts}
                  onChange={(v) => patchNegocio({ sn_usa_fgts: v })}
                />
              </Campo>
              {negocio.sn_usa_fgts === "true" && (
                <Campo label="Valor do FGTS (se souber)">
                  <CurrencyInput
                    value={negocio.vl_fgts}
                    onChange={(v) => patchNegocio({ vl_fgts: v })}
                  />
                </Campo>
              )}
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Saldo financiado = valor do imóvel − sinal − entrada (o FGTS, se usado, entra junto
                com o financiamento).
              </p>
            </>
          )}

          {negocio.tp_pagamento === "a_vista" && (
            <>
              <Campo label="Saldo para quitação (calculado)">
                <Calculado valor={saldo} />
              </Campo>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Saldo para quitação = valor do imóvel − sinal − entrada, pago na escritura.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Honorários</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Preencha em R$ ou em % — o outro campo é calculado. O total em % é sobre o valor do
            imóvel; imobiliária e corretores em % são sobre o total dos honorários.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
            <Campo label="Valor total (R$)">
              <CurrencyInput
                value={total.valor}
                onChange={(v) => {
                  patchNegocio({ vl_honorarios_total: v });
                  setBaseTotal("valor");
                }}
              />
            </Campo>
            <Campo label="% do imóvel">
              <PercentInput
                value={total.percentual}
                onChange={(v) => {
                  patchNegocio({ pc_honorarios_total: v });
                  setBaseTotal("percentual");
                }}
              />
            </Campo>
          </div>
          {baseTotal === "percentual" && vlImovel === null && (
            <p className="-mt-2 text-xs text-status-reprovado">
              Informe o valor do imóvel pra calcular o total a partir do percentual.
            </p>
          )}

          <Campo label="Quando">
            <Input
              placeholder="Ex: no ato da assinatura do contrato de financiamento"
              value={negocio.ds_honorarios_quando}
              onChange={(e) => patchNegocio({ ds_honorarios_quando: e.target.value })}
            />
          </Campo>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={imobiliariaParticipa}
              disabled={!cdImobiliaria}
              onChange={(e) => setImobiliariaParticipa(e.target.checked)}
            />
            A imobiliária participa dos honorários
            {!cdImobiliaria && (
              <span className="text-xs text-muted-foreground">(escolha a imobiliária acima)</span>
            )}
          </label>

          {imobiliariaParticipa && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
              <Campo label="Honorários da imobiliária (R$)">
                <CurrencyInput
                  value={imobiliaria.valor}
                  onChange={(v) => {
                    patchNegocio({ vl_honorarios_imobiliaria: v });
                    setBaseImobiliaria("valor");
                  }}
                />
              </Campo>
              <Campo label="% dos honorários">
                <PercentInput
                  value={imobiliaria.percentual}
                  onChange={(v) => {
                    patchNegocio({ pc_honorarios_imobiliaria: v });
                    setBaseImobiliaria("percentual");
                  }}
                />
              </Campo>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <datalist id="corretores-cadastro">
              {corretoresCadastro.map((c) => (
                <option key={c.cd_corretor} value={c.nm_corretor} />
              ))}
            </datalist>
            {corretores.map((corretor, idx) => (
              <CorretorRow
                key={idx}
                corretor={corretor}
                exibido={corretoresExibidos[idx]}
                cadastro={corretoresCadastro}
                onChange={(patch) => patchCorretor(idx, patch)}
                onRemove={() => setCorretores(corretores.filter((_, i) => i !== idx))}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() => setCorretores([...corretores, corretorVazio()])}
            >
              <Plus className="h-4 w-4" />
              Adicionar corretor
            </Button>
          </div>

          {temDistribuicao && totalNum !== null && (
            <p
              className={`text-xs ${
                diferenca === 0 ? "text-muted-foreground" : "text-status-reprovado"
              }`}
            >
              Distribuído: {formatarMoeda(distribuido)} de {formatarMoeda(totalNum)}
              {diferenca > 0 && ` — faltam ${formatarMoeda(diferenca)}`}
              {diferenca < 0 && ` — passou ${formatarMoeda(-diferenca)} do total`}
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <Button type="button" onClick={salvar} disabled={pending} className="font-bold">
          {pending
            ? edicao
              ? "Salvando..."
              : "Criando..."
            : edicao
              ? "Salvar alterações"
              : "Criar processo"}
        </Button>
        {erro && <p className="mt-2 text-sm text-status-reprovado">{erro}</p>}
      </div>
    </div>
  );
}
