"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { testarIntegracao, type ResultadoTeste } from "./actions";

export function TesteIntegracao({ id, podeTestar }: { id: string; podeTestar: boolean }) {
  const [resultado, setResultado] = useState<ResultadoTeste | null>(null);
  const [testando, startTeste] = useTransition();

  function testar() {
    setResultado(null);
    startTeste(async () => {
      setResultado(await testarIntegracao(id));
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" size="sm" disabled={testando || !podeTestar} onClick={testar}>
        {testando && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        Testar conexão
      </Button>
      {resultado && (
        <p
          role="status"
          className={`flex items-start gap-1.5 text-xs ${resultado.ok ? "text-status-aceito" : "text-status-reprovado"}`}
        >
          {resultado.ok ? (
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            {resultado.detalhe}
            {resultado.ms > 0 && <span className="text-muted-foreground"> ({resultado.ms} ms)</span>}
          </span>
        </p>
      )}
    </div>
  );
}
