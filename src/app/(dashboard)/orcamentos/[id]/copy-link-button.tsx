"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <Button
      type="button"
      variant="accent"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(link);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
    >
      {copiado ? "Copiado!" : "Copiar link"}
    </Button>
  );
}
