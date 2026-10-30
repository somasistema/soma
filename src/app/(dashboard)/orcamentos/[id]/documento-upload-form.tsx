"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CATEGORIA_DOC_INTAKE_LABEL,
  CATEGORIAS_DOC_EMPRESA,
  CATEGORIAS_DOC_IMOVEL,
  CATEGORIAS_DOC_PESSOAIS,
  LADO_PARTE_LABEL,
  PERFIL_DOCUMENTO_LABEL,
  type CategoriaDocIntake,
  type LadoParte,
  type PerfilDocumento,
} from "@/types/database";
import { uploadDocumento } from "./documentos-actions";

const PERFIS = Object.keys(PERFIL_DOCUMENTO_LABEL) as PerfilDocumento[];

export type PessoaDoProcesso = { cd_parte: string; nm_parte: string; tp_lado: LadoParte };

const IMOVEL = "__imovel";
const AVULSO = "";

const CATEGORIAS_PESSOA: CategoriaDocIntake[] = [
  ...CATEGORIAS_DOC_PESSOAIS,
  "uniao_estavel",
  ...CATEGORIAS_DOC_EMPRESA,
];

export function DocumentoUploadForm({
  cdProcesso,
  pessoas = [],
}: {
  cdProcesso: string;
  // Pessoas do processo (vendedor/comprador): documento enviado pra uma delas entra no item
  // certo do checklist e a leitura completa os dados dela. Sem pessoas = envio avulso.
  pessoas?: PessoaDoProcesso[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  // AVULSO | IMOVEL | cd_parte
  const [alvo, setAlvo] = useState<string>(pessoas.length > 0 ? pessoas[0].cd_parte : AVULSO);
  const [categoria, setCategoria] = useState<CategoriaDocIntake>("identidade");

  const pessoa = pessoas.find((p) => p.cd_parte === alvo);
  const doImovel = alvo === IMOVEL;
  const categorias = doImovel ? CATEGORIAS_DOC_IMOVEL : CATEGORIAS_PESSOA;
  const categoriaValida = categorias.includes(categoria) ? categoria : categorias[0];

  function trocarAlvo(novo: string) {
    setAlvo(novo);
    setCategoria(novo === IMOVEL ? "onus_escritura" : "identidade");
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    const formData = new FormData(evento.currentTarget);

    if (pessoa || doImovel) {
      formData.set("tp_perfil_alvo", doImovel ? "imovel" : pessoa!.tp_lado);
      formData.set("nm_tipo_documento", CATEGORIA_DOC_INTAKE_LABEL[categoriaValida]);
      formData.set("tp_categoria_intake", categoriaValida);
      if (pessoa) formData.set("cd_parte", pessoa.cd_parte);
    }

    startTransition(async () => {
      const resultado = await uploadDocumento(formData);

      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }

      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={enviar}
      className="flex flex-col gap-3 rounded-radius border border-border p-4"
    >
      <input type="hidden" name="cd_processo" value={cdProcesso} />

      {pessoas.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Escolha de quem é o documento: ele entra no item certo do checklist, o sistema lê e
          preenche os dados que estiverem em branco na pessoa (e eles saem na minuta).
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pessoas.length > 0 ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="alvo">Documento de</Label>
              <Select id="alvo" value={alvo} onChange={(e) => trocarAlvo(e.target.value)}>
                {pessoas.map((p) => (
                  <option key={p.cd_parte} value={p.cd_parte}>
                    {LADO_PARTE_LABEL[p.tp_lado]} — {p.nm_parte}
                  </option>
                ))}
                <option value={IMOVEL}>Imóvel</option>
                <option value={AVULSO}>Outro (avulso)</option>
              </Select>
            </div>

            {alvo === AVULSO ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nm_tipo_documento">Tipo de documento</Label>
                <Input
                  id="nm_tipo_documento"
                  name="nm_tipo_documento"
                  placeholder="Ex: procuração, certidão..."
                  required
                />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="categoria">Tipo de documento</Label>
                <Select
                  id="categoria"
                  value={categoriaValida}
                  onChange={(e) => setCategoria(e.target.value as CategoriaDocIntake)}
                >
                  {categorias.map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIA_DOC_INTAKE_LABEL[c]}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            {alvo === AVULSO && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tp_perfil_alvo">Perfil alvo</Label>
                <Select id="tp_perfil_alvo" name="tp_perfil_alvo" defaultValue="" required>
                  <option value="" disabled>
                    Selecione...
                  </option>
                  {PERFIS.map((perfil) => (
                    <option key={perfil} value={perfil}>
                      {PERFIL_DOCUMENTO_LABEL[perfil]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="tp_perfil_alvo">Perfil alvo</Label>
              <Select id="tp_perfil_alvo" name="tp_perfil_alvo" defaultValue="" required>
                <option value="" disabled>
                  Selecione...
                </option>
                {PERFIS.map((perfil) => (
                  <option key={perfil} value={perfil}>
                    {PERFIL_DOCUMENTO_LABEL[perfil]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nm_tipo_documento">Tipo de documento</Label>
              <Input
                id="nm_tipo_documento"
                name="nm_tipo_documento"
                placeholder="Ex: RG, comprovante de residência..."
                required
              />
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="arquivo">Arquivo</Label>
        <Input id="arquivo" name="arquivo" type="file" required />
      </div>

      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "Enviando e lendo o documento..." : "Enviar documento"}
      </Button>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
    </form>
  );
}
