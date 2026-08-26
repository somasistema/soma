"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatarTelefone } from "@/lib/utils";
import type { Imobiliaria, Usuario } from "@/types/database";
import { criarProcesso } from "./actions";

export function ProcessoForm({
  imobiliarias,
  corretores,
  vendedores,
}: {
  imobiliarias: Imobiliaria[];
  corretores: Pick<Usuario, "cd_usuario" | "nm_usuario">[];
  vendedores: Pick<Usuario, "cd_usuario" | "nm_usuario">[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [cdImobiliaria, setCdImobiliaria] = useState(imobiliarias[0]?.cd_imobiliaria ?? "");
  const [nmCompradorConvidado, setNmCompradorConvidado] = useState("");
  const [dsTelefoneComprador, setDsTelefoneComprador] = useState("");
  const [cdVendedor, setCdVendedor] = useState("");
  const [cdCorretor, setCdCorretor] = useState("");

  function salvar() {
    setErro(null);

    if (!cdImobiliaria || !nmCompradorConvidado) {
      setErro("Preencha a imobiliária e o nome do cliente.");
      return;
    }

    startTransition(async () => {
      const resultado = await criarProcesso({
        cd_imobiliaria: cdImobiliaria,
        nm_comprador_convidado: nmCompradorConvidado,
        ds_telefone_comprador_convidado: dsTelefoneComprador,
        cd_vendedor: cdVendedor || null,
        cd_corretor: cdCorretor || null,
      });

      if (resultado?.erro) {
        setErro(resultado.erro);
      }
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Dados do processo</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cd_imobiliaria">Imobiliária</Label>
          <Select
            id="cd_imobiliaria"
            value={cdImobiliaria}
            onChange={(e) => setCdImobiliaria(e.target.value)}
          >
            {imobiliarias.map((imobiliaria) => (
              <option key={imobiliaria.cd_imobiliaria} value={imobiliaria.cd_imobiliaria}>
                {imobiliaria.nm_imobiliaria}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nm_comprador_convidado">Nome do cliente</Label>
          <Input
            id="nm_comprador_convidado"
            value={nmCompradorConvidado}
            onChange={(e) => setNmCompradorConvidado(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds_telefone_comprador_convidado">Telefone do cliente</Label>
          <Input
            id="ds_telefone_comprador_convidado"
            type="tel"
            placeholder="(71) 99999-9999"
            value={dsTelefoneComprador}
            onChange={(e) => setDsTelefoneComprador(formatarTelefone(e.target.value))}
          />
        </div>
        {vendedores.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cd_vendedor">Vendedor (opcional)</Label>
            <Select id="cd_vendedor" value={cdVendedor} onChange={(e) => setCdVendedor(e.target.value)}>
              <option value="">Nenhum</option>
              {vendedores.map((vendedor) => (
                <option key={vendedor.cd_usuario} value={vendedor.cd_usuario}>
                  {vendedor.nm_usuario}
                </option>
              ))}
            </Select>
          </div>
        )}
        {corretores.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cd_corretor">Corretor (opcional)</Label>
            <Select id="cd_corretor" value={cdCorretor} onChange={(e) => setCdCorretor(e.target.value)}>
              <option value="">Nenhum</option>
              {corretores.map((corretor) => (
                <option key={corretor.cd_usuario} value={corretor.cd_usuario}>
                  {corretor.nm_usuario}
                </option>
              ))}
            </Select>
          </div>
        )}

        <div className="sm:col-span-2">
          <Button type="button" onClick={salvar} disabled={pending} className="font-bold">
            {pending ? "Criando..." : "Criar processo"}
          </Button>
          {erro && <p className="mt-2 text-sm text-status-reprovado">{erro}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
