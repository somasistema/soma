// Esqueleto ao trocar de aba — o cabeçalho e as abas (layout) ficam na tela.
export default function CarregandoAba() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Carregando">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/40" />
      ))}
    </div>
  );
}
