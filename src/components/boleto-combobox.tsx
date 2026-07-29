"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn, formatarMoeda } from "@/lib/utils";
import { TABELAS_CUSTA, TABELA_CUSTA_LABEL, type TabelaCustaItem } from "@/types/database";

function rotuloValor(item: TabelaCustaItem) {
  if (item.ds_valor_especial) return item.ds_valor_especial;
  if (item.vl_pagar != null) return formatarMoeda(item.vl_pagar);
  return "sem valor";
}

// Busca por código do ato (ex: "32069") ou por trecho da descrição —
// o usuário digita o código do boleto que quer lançar e adiciona ao
// orçamento como um item de custa a mais, junto dos serviços.
export function BoletoCombobox({
  custas,
  value,
  onChange,
}: {
  custas: TabelaCustaItem[];
  value: string;
  onChange: (cdCusta: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selecionado = custas.find((c) => c.cd_custa === value);

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
              ? `[${selecionado.cd_ato ?? "s/ código"}] ${selecionado.ds_ato} — ${rotuloValor(selecionado)}`
              : "Buscar boleto por código do ato ou descrição..."
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
                Nenhum boleto encontrado.
              </Command.Empty>

              {TABELAS_CUSTA.map((tabela) => {
                const daTabela = custas.filter((c) => c.tp_tabela === tabela);
                if (daTabela.length === 0) return null;

                return (
                  <Command.Group
                    key={tabela}
                    heading={`${tabela} — ${TABELA_CUSTA_LABEL[tabela]}`}
                    className="px-1 py-1.5 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground"
                  >
                    {daTabela.map((custa) => (
                      <Command.Item
                        key={custa.cd_custa}
                        value={`${custa.cd_ato ?? ""} ${custa.nm_secao} ${custa.ds_ato}`}
                        onSelect={() => {
                          onChange(custa.cd_custa);
                          setOpen(false);
                        }}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm text-foreground",
                          "aria-selected:bg-brand/10 aria-selected:text-brand"
                        )}
                      >
                        <span className="truncate">
                          <span className="text-muted-foreground">
                            [{custa.cd_ato ?? "s/ código"}]
                          </span>{" "}
                          {custa.ds_ato}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {rotuloValor(custa)}
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
