"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatarTelefone } from "@/lib/utils";
import { LADO_PARTE_LABEL, type Imobiliaria, type LadoParte } from "@/types/database";
import {
  criarProcesso,
  type CorretorInput,
  type NegocioInput,
  type ParteInput,
} from "./actions";

// Papéis livres além de vendedor/comprador — sem checklist de documentos.
const OUTROS_PAPEIS: LadoParte[] = ["corretor", "imobiliaria", "adm", "cliente"];

const TEXTAREA_CLASS =
  "flex min-h-[80px] w-full rounded-radius border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

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

export function ProcessoForm({ imobiliarias }: { imobiliarias: Imobiliaria[] }) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [cdImobiliaria, setCdImobiliaria] = useState(imobiliarias[0]?.cd_imobiliaria ?? "");
  const [nmCliente, setNmCliente] = useState("");
  const [dsTelefone, setDsTelefone] = useState("");

  const [vendedores, setVendedores] = useState<ParteInput[]>([parteVazia("vendedor")]);
  const [compradores, setCompradores] = useState<ParteInput[]>([parteVazia("comprador")]);
  const [outrasPartes, setOutrasPartes] = useState<ParteInput[]>([]);
  const [corretores, setCorretores] = useState<CorretorInput[]>([]);

  const [negocio, setNegocio] = useState<NegocioInput>({
    vl_imovel: "",
    vl_entrada: "",
    vl_financiamento: "",
    ds_banco: "",
    sn_possui_inquilino: "",
    sn_ocupado: "",
    ds_entrega_chaves: "",
    ds_itens_imovel: "",
    vl_honorarios_total: "",
    ds_honorarios_quando: "",
    vl_honorarios_imobiliaria: "",
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

    startTransition(async () => {
      const resultado = await criarProcesso({
        cd_imobiliaria: cdImobiliaria,
        nm_comprador_convidado: nmCliente.trim(),
        ds_telefone_comprador_convidado: dsTelefone,
        negocio,
        partes,
        corretores: corretores.filter((c) => c.nm_corretor.trim()),
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
            Corretor, imobiliária, administrador, cliente... Cada um recebe um link próprio pra
            preencher os dados e anexar documentos.
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
            onClick={() => setOutrasPartes([...outrasPartes, parteVazia("corretor")])}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Valor total">
              <CurrencyInput
                value={negocio.vl_honorarios_total}
                onChange={(v) => patchNegocio({ vl_honorarios_total: v })}
              />
            </Campo>
            <Campo label="Quando">
              <Input
                placeholder="Ex: na quitação total"
                value={negocio.ds_honorarios_quando}
                onChange={(e) => patchNegocio({ ds_honorarios_quando: e.target.value })}
              />
            </Campo>
            <Campo label="Honorários da imobiliária">
              <CurrencyInput
                value={negocio.vl_honorarios_imobiliaria}
                onChange={(v) => patchNegocio({ vl_honorarios_imobiliaria: v })}
              />
            </Campo>
          </div>

          <div className="flex flex-col gap-3">
            {corretores.map((corretor, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-3 rounded-radius border border-border p-3 sm:grid-cols-[1fr_auto_auto]">
                <Campo label="Corretor">
                  <Input
                    value={corretor.nm_corretor}
                    onChange={(e) =>
                      setCorretores(
                        corretores.map((c, i) =>
                          i === idx ? { ...c, nm_corretor: e.target.value } : c
                        )
                      )
                    }
                  />
                </Campo>
                <Campo label="Honorário">
                  <CurrencyInput
                    className="sm:w-36"
                    value={corretor.vl_honorario}
                    onChange={(v) =>
                      setCorretores(
                        corretores.map((c, i) => (i === idx ? { ...c, vl_honorario: v } : c))
                      )
                    }
                  />
                </Campo>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Remover corretor"
                    onClick={() => setCorretores(corretores.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit gap-1.5"
              onClick={() =>
                setCorretores([...corretores, { nm_corretor: "", vl_honorario: "", ds_lado: "" }])
              }
            >
              <Plus className="h-4 w-4" />
              Adicionar corretor
            </Button>
          </div>
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
