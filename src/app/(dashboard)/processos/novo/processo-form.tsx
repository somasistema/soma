"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PercentInput } from "@/components/ui/percent-input";
import { Select } from "@/components/ui/select";
import { formatarMoeda, formatarTelefone } from "@/lib/utils";
import {
  LADO_PARTE_LABEL,
  type Corretor,
  type Imobiliaria,
  type LadoParte,
} from "@/types/database";
import {
  criarProcesso,
  type CorretorInput,
  type NegocioInput,
  type ParteInput,
} from "./actions";

// Papéis livres além de vendedor/comprador — sem checklist de documentos.
// Corretor não entra aqui: quem está nos Honorários já vira parte sozinho.
const OUTROS_PAPEIS: LadoParte[] = ["imobiliaria", "adm", "cliente"];

const TEXTAREA_CLASS =
  "flex min-h-[80px] w-full rounded-radius border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

// Qual dos dois campos (R$ ou %) o usuário digitou por último — o outro
// é calculado a partir dele.
type Base = "valor" | "percentual";

type CorretorLinha = CorretorInput & { base: Base };

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

const parteVazia = (tp_lado: LadoParte): ParteInput => ({
  tp_lado,
  nr_ordem: 0,
  nm_parte: "",
  ds_telefone: "",
  ds_email: "",
  ds_profissao: "",
  ds_conta_bancaria: "",
  ds_documentos_obs: "",
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
});

function OutraParteRow({
  parte,
  onChange,
  onRemove,
}: {
  parte: ParteInput;
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
        <Input value={parte.nm_parte} onChange={(e) => onChange({ nm_parte: e.target.value })} />
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
  titulo,
  onChange,
  onRemove,
  podeRemover,
}: {
  parte: ParteInput;
  titulo: string;
  onChange: (patch: Partial<ParteInput>) => void;
  onRemove: () => void;
  podeRemover: boolean;
}) {
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Nome">
          <Input value={parte.nm_parte} onChange={(e) => onChange({ nm_parte: e.target.value })} />
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
        <Campo label="Profissão">
          <Input
            value={parte.ds_profissao}
            onChange={(e) => onChange({ ds_profissao: e.target.value })}
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

      <p className="text-xs text-muted-foreground">
        Os documentos (identidade, certidões, comprovante...) são anexados na tela do processo
        depois de criado — quem anexa fica como OK, quem não anexa fica como Falta.
      </p>
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
    ? cadastro.find((c) => c.cd_corretor === corretor.cd_corretor) ?? null
    : null;

  function trocarNome(nome: string) {
    const achado = cadastro.find(
      (c) => c.nm_corretor.trim().toLowerCase() === nome.trim().toLowerCase()
    );
    onChange({ nm_corretor: nome, cd_corretor: achado?.cd_corretor ?? "" });
  }

  const resumoCadastro = doCadastro
    ? [
        doCadastro.ds_cpf && `CPF ${doCadastro.ds_cpf}`,
        doCadastro.ds_creci && `CRECI ${doCadastro.ds_creci}`,
        doCadastro.ds_pix && `PIX ${doCadastro.ds_pix}`,
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
          Do cadastro de corretores{resumoCadastro ? `: ${resumoCadastro}` : ""}.
        </p>
      ) : (
        corretor.nm_corretor.trim() && (
          <details className="rounded-radius border border-dashed border-border px-3 py-2">
            <summary className="cursor-pointer text-xs text-foreground">
              Corretor novo — dados pro cadastro (opcional)
            </summary>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Campo label="CPF">
                <Input
                  value={corretor.ds_cpf}
                  onChange={(e) => onChange({ ds_cpf: e.target.value })}
                />
              </Campo>
              <Campo label="CRECI">
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
              <Campo label="E-mail" className="sm:col-span-2">
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
}: {
  imobiliarias: Imobiliaria[];
  corretoresCadastro: Corretor[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [cdImobiliaria, setCdImobiliaria] = useState(imobiliarias[0]?.cd_imobiliaria ?? "");
  const [nmCliente, setNmCliente] = useState("");
  const [dsTelefone, setDsTelefone] = useState("");

  const [vendedores, setVendedores] = useState<ParteInput[]>([parteVazia("vendedor")]);
  const [compradores, setCompradores] = useState<ParteInput[]>([parteVazia("comprador")]);
  const [outrasPartes, setOutrasPartes] = useState<ParteInput[]>([]);
  const [corretores, setCorretores] = useState<CorretorLinha[]>([]);
  const [baseTotal, setBaseTotal] = useState<Base>("valor");
  const [baseImobiliaria, setBaseImobiliaria] = useState<Base>("valor");

  const [negocio, setNegocio] = useState<NegocioInput>({
    vl_imovel: "",
    vl_entrada: "",
    vl_financiamento: "",
    ds_banco: "",
    sn_possui_inquilino: "",
    sn_ocupado: "",
    ds_entrega_chaves: "",
    ds_itens_imovel: "",
    ds_imovel_endereco: "",
    ds_imovel_matricula: "",
    ds_imovel_iptu: "",
    vl_honorarios_total: "",
    pc_honorarios_total: "",
    ds_honorarios_quando: "",
    vl_honorarios_imobiliaria: "",
    pc_honorarios_imobiliaria: "",
  });

  function patchNegocio(patch: Partial<NegocioInput>) {
    setNegocio((n) => ({ ...n, ...patch }));
  }

  function patchParte(
    lista: ParteInput[],
    setLista: (v: ParteInput[]) => void,
    idx: number,
    patch: Partial<ParteInput>
  ) {
    setLista(lista.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function patchCorretor(idx: number, patch: Partial<CorretorLinha>) {
    setCorretores((lista) => lista.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  // Honorários: total em R$ ou % do imóvel; imobiliária e corretores em
  // R$ ou % do total. O campo digitado por último manda, o outro é
  // calculado — mudar o total recalcula quem foi lançado em %.
  const total = derivar(
    baseTotal,
    negocio.vl_honorarios_total,
    negocio.pc_honorarios_total,
    num(negocio.vl_imovel)
  );
  const totalNum = num(total.valor);
  const imobiliaria = derivar(
    baseImobiliaria,
    negocio.vl_honorarios_imobiliaria,
    negocio.pc_honorarios_imobiliaria,
    totalNum
  );
  const corretoresExibidos = corretores.map((c) =>
    derivar(c.base, c.vl_honorario, c.pc_honorario, totalNum)
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
    if (!cdImobiliaria || !nmCliente.trim()) {
      setErro("Preencha a imobiliária e o nome do cliente.");
      return;
    }

    const partes: ParteInput[] = [
      ...vendedores.map((p, i) => ({ ...p, tp_lado: "vendedor" as const, nr_ordem: i })),
      ...compradores.map((p, i) => ({ ...p, tp_lado: "comprador" as const, nr_ordem: i })),
      ...outrasPartes.map((p, i) => ({ ...p, nr_ordem: i })),
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
      }))
      .filter((c) => c.nm_corretor.trim());

    startTransition(async () => {
      const resultado = await criarProcesso({
        cd_imobiliaria: cdImobiliaria,
        nm_comprador_convidado: nmCliente.trim(),
        ds_telefone_comprador_convidado: dsTelefone,
        negocio: {
          ...negocio,
          vl_honorarios_total: total.valor,
          pc_honorarios_total: total.percentual,
          vl_honorarios_imobiliaria: imobiliaria.valor,
          pc_honorarios_imobiliaria: imobiliaria.percentual,
        },
        partes,
        corretores: corretoresFinal,
      });
      if (resultado?.erro) setErro(resultado.erro);
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Dados do processo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Imobiliária" htmlFor="cd_imobiliaria">
            <Select
              id="cd_imobiliaria"
              value={cdImobiliaria}
              onChange={(e) => setCdImobiliaria(e.target.value)}
            >
              {imobiliarias.map((imob) => (
                <option key={imob.cd_imobiliaria} value={imob.cd_imobiliaria}>
                  {imob.nm_imobiliaria}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo label="Nome do cliente" htmlFor="nm_cliente">
            <Input
              id="nm_cliente"
              value={nmCliente}
              onChange={(e) => setNmCliente(e.target.value)}
            />
          </Campo>
          <Campo label="Telefone do cliente" htmlFor="ds_telefone">
            <Input
              id="ds_telefone"
              type="tel"
              placeholder="(71) 99999-9999"
              value={dsTelefone}
              onChange={(e) => setDsTelefone(formatarTelefone(e.target.value))}
            />
          </Campo>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vendedores</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {vendedores.map((parte, idx) => (
            <ParteFields
              key={idx}
              parte={parte}
              titulo={idx === 0 ? "Vendedor" : `Vendedor / cônjuge ${idx + 1}`}
              podeRemover={vendedores.length > 1}
              onChange={(patch) => patchParte(vendedores, setVendedores, idx, patch)}
              onRemove={() => setVendedores(vendedores.filter((_, i) => i !== idx))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={() => setVendedores([...vendedores, parteVazia("vendedor")])}
          >
            <Plus className="h-4 w-4" />
            Adicionar vendedor
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Compradores</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {compradores.map((parte, idx) => (
            <ParteFields
              key={idx}
              parte={parte}
              titulo={idx === 0 ? "Comprador" : `Comprador / cônjuge ${idx + 1}`}
              podeRemover={compradores.length > 1}
              onChange={(patch) => patchParte(compradores, setCompradores, idx, patch)}
              onRemove={() => setCompradores(compradores.filter((_, i) => i !== idx))}
            />
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit gap-1.5"
            onClick={() => setCompradores([...compradores, parteVazia("comprador")])}
          >
            <Plus className="h-4 w-4" />
            Adicionar comprador
          </Button>
        </CardContent>
      </Card>

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
          <Campo label="Endereço do imóvel" className="sm:col-span-2">
            <Input
              placeholder="Rua, número, complemento, bairro, cidade/UF"
              value={negocio.ds_imovel_endereco}
              onChange={(e) => patchNegocio({ ds_imovel_endereco: e.target.value })}
            />
          </Campo>
          <Campo label="Matrícula">
            <Input
              value={negocio.ds_imovel_matricula}
              onChange={(e) => patchNegocio({ ds_imovel_matricula: e.target.value })}
            />
          </Campo>
          <Campo label="Inscrição do IPTU">
            <Input
              value={negocio.ds_imovel_iptu}
              onChange={(e) => patchNegocio({ ds_imovel_iptu: e.target.value })}
            />
          </Campo>
          <Campo label="Valor do imóvel">
            <CurrencyInput
              value={negocio.vl_imovel}
              onChange={(v) => patchNegocio({ vl_imovel: v })}
            />
          </Campo>
          <Campo label="Valor de entrada (se houver)">
            <CurrencyInput
              value={negocio.vl_entrada}
              onChange={(v) => patchNegocio({ vl_entrada: v })}
            />
          </Campo>
          <Campo label="Valor do financiamento">
            <CurrencyInput
              value={negocio.vl_financiamento}
              onChange={(v) => patchNegocio({ vl_financiamento: v })}
            />
          </Campo>
          <Campo label="Qual banco">
            <Input
              value={negocio.ds_banco}
              onChange={(e) => patchNegocio({ ds_banco: e.target.value })}
            />
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
          <Campo label="Entrega das chaves" className="sm:col-span-2">
            <Input
              placeholder="Ex: 30 dias após o recurso final"
              value={negocio.ds_entrega_chaves}
              onChange={(e) => patchNegocio({ ds_entrega_chaves: e.target.value })}
            />
          </Campo>
          <Campo label="O que fica no imóvel (por cômodo)" className="sm:col-span-2">
            <textarea
              className={TEXTAREA_CLASS}
              placeholder="Ex: armários embutidos nos 2 quartos"
              value={negocio.ds_itens_imovel}
              onChange={(e) => patchNegocio({ ds_itens_imovel: e.target.value })}
            />
          </Campo>
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
          {baseTotal === "percentual" && num(negocio.vl_imovel) === null && (
            <p className="-mt-2 text-xs text-status-reprovado">
              Informe o valor do imóvel pra calcular o total a partir do percentual.
            </p>
          )}

          <Campo label="Quando">
            <Input
              placeholder="Ex: na assinatura do contrato de financiamento"
              value={negocio.ds_honorarios_quando}
              onChange={(e) => patchNegocio({ ds_honorarios_quando: e.target.value })}
            />
          </Campo>

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
          {pending ? "Criando..." : "Criar processo"}
        </Button>
        {erro && <p className="mt-2 text-sm text-status-reprovado">{erro}</p>}
      </div>
    </div>
  );
}
