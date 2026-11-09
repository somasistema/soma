"use client";

import { Search } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { consultarCep, consultarCnpj } from "@/lib/consultas-externas";
import { formatarCep, soDigitos, type DadosCnpj } from "@/lib/consultas-publicas";
import { documentoFiscalValido } from "@/lib/documento-fiscal";

// Busca o endereço pelo CEP. O CEP só traz rua, bairro e cidade: o número e o complemento a pessoa completa.
export function BuscaCep({
  atual,
  onEndereco,
  className,
}: {
  atual: string;
  onEndereco: (texto: string) => void;
  className?: string;
}) {
  const [cep, setCep] = useState("");
  const [pendente, startConsulta] = useTransition();
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);

  function buscar() {
    setMensagem(null);
    startConsulta(async () => {
      const r = await consultarCep(cep);
      if (!r.ok) {
        setMensagem({ ok: false, texto: r.erro });
        return;
      }
      if (atual.trim() && !window.confirm("Já há um endereço digitado. Substituir pelo endereço do CEP?")) return;
      onEndereco(r.dados.texto);
      setMensagem({ ok: true, texto: "Endereço preenchido. Complete o número e o complemento." });
    });
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          inputMode="numeric"
          aria-label="CEP para buscar o endereço"
          placeholder="CEP: 00000-000"
          className="h-8 w-36 text-xs"
          value={cep}
          onChange={(e) => setCep(formatarCep(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (soDigitos(cep).length === 8 && !pendente) buscar();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={pendente || soDigitos(cep).length !== 8}
          onClick={buscar}
        >
          <Search className="h-3.5 w-3.5" />
          {pendente ? "Buscando..." : "Buscar endereço pelo CEP"}
        </Button>
      </div>
      {mensagem && (
        <p role="status" className={`mt-1 text-xs ${mensagem.ok ? "text-status-aceito" : "text-status-reprovado"}`}>
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}

// Busca razão social, endereço, telefone e e-mail da empresa na Receita. Quem recebe decide o que preencher
// (o formulário só completa o que está vazio).
export function BotaoConsultarCnpj({
  cnpj,
  onDados,
  className,
}: {
  cnpj: string;
  onDados: (dados: DadosCnpj) => void;
  className?: string;
}) {
  const [pendente, startConsulta] = useTransition();
  const [mensagem, setMensagem] = useState<{ tom: "ok" | "aviso" | "erro"; texto: string } | null>(null);
  const valido = soDigitos(cnpj).length === 14 && documentoFiscalValido(cnpj);

  function buscar() {
    setMensagem(null);
    startConsulta(async () => {
      const r = await consultarCnpj(cnpj);
      if (!r.ok) {
        setMensagem({ tom: "erro", texto: r.erro });
        return;
      }
      onDados(r.dados);
      setMensagem(
        r.dados.ativa
          ? { tom: "ok", texto: "Dados da Receita Federal carregados nos campos vazios. Confira." }
          : {
              tom: "aviso",
              texto: `Atenção: a situação cadastral desta empresa é ${r.dados.situacao}. Confira antes de seguir.`,
            }
      );
    });
  }

  const cor = mensagem?.tom === "ok" ? "text-status-aceito" : mensagem?.tom === "aviso" ? "text-status-pendente" : "text-status-reprovado";

  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        disabled={pendente || !valido}
        onClick={buscar}
        title={valido ? undefined : "Digite um CNPJ válido para buscar"}
      >
        <Search className="h-3.5 w-3.5" />
        {pendente ? "Buscando..." : "Buscar dados do CNPJ"}
      </Button>
      {mensagem && (
        <p role="status" className={`mt-1 text-xs ${cor}`}>
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
