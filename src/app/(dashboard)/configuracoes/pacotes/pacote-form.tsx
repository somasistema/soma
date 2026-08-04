"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ServicoCombobox } from "@/components/servico-combobox";
import { BoletoCombobox } from "@/components/boleto-combobox";
import {
  TABELAS_CUSTA,
  TABELA_CUSTA_LABEL,
  type ServicoComPrecos,
  type TabelaCustaItem,
  type TipoOrigemPacoteItem,
  type TipoSecaoPadraoPacoteItem,
} from "@/types/database";
import { criarPacoteItem } from "./actions";

const ORIGEM_LABEL: Record<TipoOrigemPacoteItem, string> = {
  custa: "Boleto fixo",
  faixa: "Valor variável por faixa (Lavratura/Registro)",
  itiv: "ITIV — 3% automático sobre a base de cálculo",
};

export function PacoteForm({
  servicos,
  custas,
  cidades,
}: {
  servicos: ServicoComPrecos[];
  custas: TabelaCustaItem[];
  cidades: string[];
}) {
  const [state, action, pending] = useActionState(criarPacoteItem, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [cdServico, setCdServico] = useState("");
  const [tpOrigem, setTpOrigem] = useState<TipoOrigemPacoteItem>("custa");
  const [cdCusta, setCdCusta] = useState("");
  const [tpTabelaFaixa, setTpTabelaFaixa] = useState<TabelaCustaItem["tp_tabela"] | "">("");
  const [nmSecaoFaixa, setNmSecaoFaixa] = useState("");
  const [tpSecaoPadrao, setTpSecaoPadrao] = useState<TipoSecaoPadraoPacoteItem>("inicial");

  // Ao voltar pro estado "sucesso" (null) depois de um submit, limpa
  // os campos controlados — feito durante a renderização (não em
  // efeito) pra não disparar setState encadeado.
  const [estadoAnterior, setEstadoAnterior] = useState(state);
  if (state !== estadoAnterior) {
    setEstadoAnterior(state);
    if (state === null) {
      setCdServico("");
      setCdCusta("");
      setTpTabelaFaixa("");
      setNmSecaoFaixa("");
      setTpSecaoPadrao("inicial");
    }
  }

  useEffect(() => {
    if (state === null) formRef.current?.reset();
  }, [state]);

  const secoesDaTabela = useMemo(() => {
    if (!tpTabelaFaixa) return [];
    return Array.from(
      new Set(custas.filter((c) => c.tp_tabela === tpTabelaFaixa).map((c) => c.nm_secao))
    );
  }, [custas, tpTabelaFaixa]);

  const podeSalvar =
    !!cdServico &&
    (tpOrigem === "itiv" ||
      (tpOrigem === "custa" && !!cdCusta) ||
      (tpOrigem === "faixa" && !!tpTabelaFaixa && !!nmSecaoFaixa));

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 space-y-0">
        <Plus className="h-5 w-5 text-accent" />
        <CardTitle>Vincular item a um serviço</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={action} className="flex flex-col gap-4">
          <input type="hidden" name="cd_servico" value={cdServico} />
          <input type="hidden" name="tp_origem" value={tpOrigem} />
          <input type="hidden" name="cd_custa" value={cdCusta} />
          <input type="hidden" name="tp_tabela_faixa" value={tpTabelaFaixa} />
          <input type="hidden" name="nm_secao_faixa" value={nmSecaoFaixa} />
          <input type="hidden" name="tp_secao_padrao" value={tpSecaoPadrao} />

          <div className="flex flex-col gap-1.5">
            <Label>Serviço</Label>
            <ServicoCombobox
              servicos={servicos}
              nmCidade={cidades[0] ?? ""}
              value={cdServico}
              onChange={setCdServico}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp_origem">Tipo</Label>
            <Select
              id="tp_origem"
              value={tpOrigem}
              onChange={(e) => {
                setTpOrigem(e.target.value as TipoOrigemPacoteItem);
                setCdCusta("");
                setTpTabelaFaixa("");
                setNmSecaoFaixa("");
              }}
            >
              {(Object.keys(ORIGEM_LABEL) as TipoOrigemPacoteItem[]).map((origem) => (
                <option key={origem} value={origem}>
                  {ORIGEM_LABEL[origem]}
                </option>
              ))}
            </Select>
          </div>

          {tpOrigem === "custa" && (
            <div className="flex flex-col gap-1.5">
              <Label>Boleto</Label>
              <BoletoCombobox custas={custas} value={cdCusta} onChange={setCdCusta} />
            </div>
          )}

          {tpOrigem === "faixa" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tp_tabela_faixa">Tabela</Label>
                <Select
                  id="tp_tabela_faixa"
                  value={tpTabelaFaixa}
                  onChange={(e) => {
                    setTpTabelaFaixa(e.target.value as TabelaCustaItem["tp_tabela"]);
                    setNmSecaoFaixa("");
                  }}
                >
                  <option value="">Selecione...</option>
                  {TABELAS_CUSTA.map((tabela) => (
                    <option key={tabela} value={tabela}>
                      {tabela} — {TABELA_CUSTA_LABEL[tabela]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nm_secao_faixa">Seção</Label>
                <Select
                  id="nm_secao_faixa"
                  value={nmSecaoFaixa}
                  onChange={(e) => setNmSecaoFaixa(e.target.value)}
                  disabled={!tpTabelaFaixa}
                >
                  <option value="">Selecione...</option>
                  {secoesDaTabela.map((secao) => (
                    <option key={secao} value={secao}>
                      {secao}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                O sistema busca a linha certa dessa tabela/seção pelo valor (maior entre valor da
                transação e valor venal) no momento em que o serviço é adicionado ao orçamento.
              </p>
            </div>
          )}

          {tpOrigem === "itiv" && (
            <p className="text-xs text-muted-foreground">
              Calcula 3% sobre o maior valor entre transação e venal automaticamente — só entra se
              o orçamento tiver algum desses dois valores preenchido.
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tp_secao_padrao">Seção do orçamento</Label>
            <Select
              id="tp_secao_padrao"
              value={tpSecaoPadrao}
              onChange={(e) => setTpSecaoPadrao(e.target.value as TipoSecaoPadraoPacoteItem)}
            >
              <option value="inicial">Custos Iniciais</option>
              <option value="final">Custos Finais</option>
              <option value="ambas">Ambas (duplica — ex: Prenotação)</option>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox name="sn_opcional" />
            Opcional — sugerido, mas o operador decide se mantém em cada orçamento
          </label>

          <Button type="submit" disabled={pending || !podeSalvar} className="self-start">
            {pending ? "Salvando..." : "Vincular"}
          </Button>
          {state?.erro && <p className="text-sm text-status-reprovado">{state.erro}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
