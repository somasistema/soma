function formatarValor(valor: unknown) {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  return String(valor);
}

// Pra UPDATE, mostra só os campos que realmente mudaram (antes → depois)
// — o registro inteiro em JSON é ruído, o que importa é o que mudou.
export function LogDiff({
  operacao,
  antigos,
  novos,
}: {
  operacao: "INSERT" | "UPDATE" | "DELETE";
  antigos: Record<string, unknown> | null;
  novos: Record<string, unknown> | null;
}) {
  if (operacao === "INSERT") {
    return (
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
        {Object.entries(novos ?? {})
          .filter(([chave]) => !chave.startsWith("ts_") && !chave.startsWith("cd_"))
          .slice(0, 6)
          .map(([chave, valor]) => (
            <span key={chave}>
              <strong className="text-foreground">{chave}:</strong> {formatarValor(valor)}
            </span>
          ))}
      </div>
    );
  }

  if (operacao === "DELETE") {
    return (
      <p className="text-xs text-muted-foreground">
        Registro removido — {Object.keys(antigos ?? {}).length} campos no snapshot.
      </p>
    );
  }

  const campos = Object.keys({ ...(antigos ?? {}), ...(novos ?? {}) }).filter((chave) => {
    if (chave.startsWith("ts_")) return false;
    const antes = antigos?.[chave];
    const depois = novos?.[chave];
    return JSON.stringify(antes) !== JSON.stringify(depois);
  });

  if (campos.length === 0) {
    return <p className="text-xs text-muted-foreground">Sem mudança de campos (só timestamp).</p>;
  }

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {campos.map((chave) => (
        <p key={chave} className="text-muted-foreground">
          <strong className="text-foreground">{chave}:</strong>{" "}
          <span className="text-status-reprovado line-through">{formatarValor(antigos?.[chave])}</span>{" "}
          → <span className="text-status-aceito">{formatarValor(novos?.[chave])}</span>
        </p>
      ))}
    </div>
  );
}
