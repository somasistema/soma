"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ModeloEditor } from "./modelo-editor";

export function NovoModelo() {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Button type="button" className="gap-1.5 self-start" onClick={() => setAberto(true)}>
        <Plus className="h-4 w-4" />
        Novo modelo
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <ModeloEditor onPronto={() => setAberto(false)} />
      </CardContent>
    </Card>
  );
}
