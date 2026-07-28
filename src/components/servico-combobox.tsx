"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn, formatarMoeda } from "@/lib/utils";
import { LOCAIS_SERVICO, LOCAL_SERVICO_LABEL, type ServicoComPrecos } from "@/types/database";

function rotuloPreco(servico: ServicoComPrecos, nmCidade: string) {
  if (servico.sn_valor_variavel) return "valor variável";
  const preco = servico.servico_precos.find((p) => p.nm_cidade === nmCidade)?.vl_valor;
  return preco != null ? formatarMoeda(preco) : "sem preço nesta cidade";
}

export function ServicoCombobox({
  servicos,
  nmCidade,
  value,
  onChange,
}: {
  servicos: ServicoComPrecos[];
  nmCidade: string;
  value: string;
  onChange: (cdServico: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selecionado = servicos.find((s) => s.cd_servico === value);

  useEffect(() => {
    function aoClicarFora(evento: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(evento.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, []);

  return (
    <Command ref={containerRef} shouldFilter loop className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Command.Input
          onFocus={() => setOpen(true)}
          placeholder={
            selecionado
              ? `[${selecionado.nm_categoria}] ${selecionado.nm_servico} — ${rotuloPreco(selecionado, nmCidade)}`
              : "Buscar serviço por nome, código ou categoria..."
          }
          className="flex h-10 w-full rounded-radius border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-20 mt-1.5 max-h-80 w-full overflow-y-auto rounded-radius border border-border bg-card p-1 shadow-lg"
          >
            <Command.List>
              <Command.Empty className="p-4 text-center text-sm text-muted-foreground">
                Nenhum serviço encontrado.
              </Command.Empty>

              {LOCAIS_SERVICO.map((local) => {
                const doLocal = servicos.filter((s) => s.tp_local === local);
                if (doLocal.length === 0) return null;

                return (
                  <Command.Group
                    key={local}
                    heading={`${local} — ${LOCAL_SERVICO_LABEL[local]}`}
                    className="px-1 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {doLocal.map((servico) => (
                      <Command.Item
                        key={servico.cd_servico}
                        value={`${servico.cd_codigo ?? ""} ${servico.nm_categoria ?? ""} ${servico.nm_servico}`}
                        onSelect={() => {
                          onChange(servico.cd_servico);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-foreground",
                          "aria-selected:bg-brand/10 aria-selected:text-brand"
                        )}
                      >
                        <span className="truncate">
                          <span className="text-muted-foreground">[{servico.nm_categoria}]</span>{" "}
                          {servico.nm_servico}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {rotuloPreco(servico, nmCidade)}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </motion.div>
        )}
      </AnimatePresence>
    </Command>
  );
}
