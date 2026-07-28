import {
  TERMO_DESPACHANTE_INTRO,
  TERMO_DESPACHANTE_SECOES,
  TERMO_DESPACHANTE_TITULO,
} from "@/lib/termo-despachante";

export function TermoDespachanteBox() {
  return (
    <div className="max-h-80 overflow-y-auto rounded-radius border border-border bg-muted/50 p-4 text-sm leading-relaxed text-foreground">
      <h3 className="mb-2 font-serif-doc text-base font-semibold">{TERMO_DESPACHANTE_TITULO}</h3>
      <p className="mb-4 text-muted-foreground">{TERMO_DESPACHANTE_INTRO}</p>
      {TERMO_DESPACHANTE_SECOES.map((secao) => (
        <div key={secao.titulo} className="mb-3">
          <p className="font-medium">{secao.titulo}</p>
          {secao.paragrafos.map((paragrafo, index) => (
            <p key={index} className="mt-1 text-muted-foreground">
              {paragrafo}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
