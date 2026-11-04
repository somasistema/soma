"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FlaskConical,
  History,
  Redo2,
  Replace,
  Search,
  Sparkles,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { EditorContent, Extension, useEditor } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { AtivoBadge } from "@/components/ui/ativo-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { docParaTexto, textoParaDoc, type DocMinuta } from "@/lib/minuta-doc";
import { LACUNA } from "@/lib/minuta-lacunas";
import { renderMarcado } from "@/lib/minuta-marcacao";
import { analisarModelo, campoConhecido, REGEX_TAG } from "@/lib/modelo-campos";
import { cn, formatarData } from "@/lib/utils";
import {
  CAMPOS_MODELO_CONTRATO,
  type ModeloContrato,
  type ModeloContratoVersao,
} from "@/types/database";
import { aplicarEdicoesModelo, type EdicaoModelo } from "@/lib/modelo-edicoes";
import { previaDoModelo, salvarModelo, sugerirComIA } from "./actions";

export type ProcessoExemplo = { cd_processo: string; rotulo: string };

// {{campos}} em azul, blocos {{#x}}...{{/x}} em roxo, campo desconhecido em vermelho ondulado e as
// lacunas do texto (XXXX, 0000) em vermelho. Só visual: não entra no texto salvo.
const DestacarModelo = Extension.create({
  name: "destacarModelo",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((no, pos) => {
              if (!no.isText || !no.text) return;
              for (const m of no.text.matchAll(REGEX_TAG)) {
                const de = pos + (m.index ?? 0);
                const classe = !campoConhecido(m[2])
                  ? "bg-red-100 text-red-700 underline decoration-wavy"
                  : m[1]
                    ? "bg-violet-100 text-violet-700"
                    : "bg-sky-100 text-sky-800";
                decos.push(Decoration.inline(de, de + m[0].length, { class: `${classe} rounded px-0.5` }));
              }
              for (const m of no.text.matchAll(LACUNA)) {
                const de = pos + (m.index ?? 0);
                decos.push(Decoration.inline(de, de + m[0].length, { class: "font-semibold text-red-600" }));
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

function Botao({
  titulo,
  desabilitado,
  onClick,
  children,
}: {
  titulo: string;
  desabilitado?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={desabilitado}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!desabilitado) onClick();
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}

const CAMPOS_DE_BLOCO = [
  "vendedor_2", "vendedor_2_conjuge", "vendedor_2_companheiro", "comprador_2", "comprador_2_conjuge",
  "pagamento_financiado", "pagamento_a_vista", "imovel_usa_fgts", "imovel_sinal", "imovel_entrada",
  "imovel_itens", "imovel_iptu", "honorarios_imobiliaria", "corretor_2", "corretor_3", "locacao_tem_caucao",
  "locacao_condominio", "locacao_iptu", "locacao_taxas",
];

export function EditorModelo({
  modelo,
  inicialTexto = "",
  inicialNome = "",
  editavel,
  versoes,
  processos,
}: {
  modelo?: ModeloContrato;
  inicialTexto?: string;
  inicialNome?: string;
  editavel: boolean;
  versoes: ModeloContratoVersao[];
  processos: ProcessoExemplo[];
}) {
  const router = useRouter();
  const [salvando, startSalvar] = useTransition();
  const [testando, startTestar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const textoBase = modelo?.ds_conteudo ?? inicialTexto;
  // O que está salvo: serve pra saber se há alteração pendente.
  const [base, setBase] = useState({
    texto: textoBase.trim(),
    nome: (modelo?.nm_modelo ?? inicialNome).trim(),
    desc: (modelo?.ds_descricao ?? "").trim(),
  });

  const [nm, setNm] = useState(modelo?.nm_modelo ?? inicialNome);
  const [descricao, setDescricao] = useState(modelo?.ds_descricao ?? "");
  const [texto, setTexto] = useState(textoBase.trim());

  const [busca, setBusca] = useState("");
  const [localizar, setLocalizar] = useState("");
  const [substituir, setSubstituir] = useState("");
  const [mostrarLocalizar, setMostrarLocalizar] = useState(false);
  const [mostrarVersoes, setMostrarVersoes] = useState(false);
  const [blocoCampo, setBlocoCampo] = useState(CAMPOS_DE_BLOCO[0]);

  const [processoTeste, setProcessoTeste] = useState(processos[0]?.cd_processo ?? "");
  const [previa, setPrevia] = useState<string | null>(null);
  const [erroPrevia, setErroPrevia] = useState<string | null>(null);

  // Assistente de IA
  const [instrucao, setInstrucao] = useState("");
  const [consultando, startConsulta] = useTransition();
  const [sugestoes, setSugestoes] = useState<{ edicoes: EdicaoModelo[]; avisos: string[] } | null>(null);
  const [marcadas, setMarcadas] = useState<Set<number>>(new Set());
  const [erroIA, setErroIA] = useState<string | null>(null);
  const [convite, setConvite] = useState(!modelo && inicialTexto.trim().length > 0);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: editavel,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        italic: false,
        underline: false,
      }),
      TextAlign.configure({ types: ["paragraph"] }),
      DestacarModelo,
    ],
    // Mesma conversão da minuta: título e cláusulas aparecem em negrito/centralizados como ficam no
    // contrato. O formato é aplicado automaticamente na hora de gerar; o que se salva é o texto.
    content: textoParaDoc(textoBase),
    editorProps: {
      attributes: {
        class: "min-h-[560px] whitespace-pre-wrap outline-none [&_p]:mb-2 [&_p]:min-h-[1em]",
        spellcheck: "true",
        lang: "pt-BR",
      },
    },
    onUpdate: ({ editor: e }) => setTexto(docParaTexto(e.getJSON() as DocMinuta)),
  });

  const problemas = useMemo(() => analisarModelo(texto), [texto]);
  const alterado = texto.trim() !== base.texto || nm.trim() !== base.nome || descricao.trim() !== base.desc;

  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  const grupos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return CAMPOS_MODELO_CONTRATO.map((g) => ({
      ...g,
      campos: g.campos.filter(
        (c) => !q || c.token.toLowerCase().includes(q) || c.descricao.toLowerCase().includes(q)
      ),
    })).filter((g) => g.campos.length > 0);
  }, [busca]);

  function inserir(token: string) {
    if (!editor || !editavel) return;
    // "{{#campo}}" / "{{^campo}}" sozinhos viram o par já fechado, com o cursor no meio.
    const abre = /^\{\{([#^])([A-Za-z0-9_]+)\}\}$/.exec(token);
    if (abre) {
      const fecha = `{{/${abre[2]}}}`;
      editor.chain().focus().insertContent(token + fecha).run();
      editor.commands.setTextSelection(editor.state.selection.from - fecha.length);
      return;
    }
    editor.chain().focus().insertContent(token).run();
  }

  function envolver(tipo: "#" | "^") {
    if (!editor || !editavel) return;
    const { from, to, empty } = editor.state.selection;
    const abre = `{{${tipo}${blocoCampo}}}`;
    const fecha = `{{/${blocoCampo}}}`;
    if (empty) {
      inserir(abre);
      return;
    }
    const sel = editor.state.doc.textBetween(from, to, "\n");
    editor.chain().focus().insertContentAt({ from, to }, abre + sel + fecha).run();
  }

  function substituirTudo() {
    if (!editor || !localizar) return;
    const atual = docParaTexto(editor.getJSON() as DocMinuta);
    const n = atual.split(localizar).length - 1;
    if (n === 0) {
      setOk(null);
      setErro(`"${localizar}" não aparece no texto.`);
      return;
    }
    editor.commands.setContent(textoParaDoc(atual.split(localizar).join(substituir)));
    setTexto(docParaTexto(editor.getJSON() as DocMinuta));
    setErro(null);
    setOk(`${n} ocorrência(s) trocada(s). Lembre de salvar.`);
  }

  function carregarVersao(v: ModeloContratoVersao) {
    if (!editor) return;
    if (alterado && !confirm("Há alterações não salvas. Trocar pelo texto desta versão?")) return;
    editor.commands.setContent(textoParaDoc(v.ds_conteudo));
    setTexto(docParaTexto(editor.getJSON() as DocMinuta));
    setNm(v.nm_modelo);
    setOk(`Texto da versão ${v.nr_versao} carregado. Salve para criar uma versão nova com ele.`);
    setErro(null);
    setMostrarVersoes(false);
  }

  function salvar() {
    setErro(null);
    setOk(null);
    startSalvar(async () => {
      const r = await salvarModelo({
        cd_modelo: modelo?.cd_modelo ?? null,
        nm_modelo: nm,
        ds_descricao: descricao,
        ds_conteudo: texto,
      });
      if ("erro" in r) {
        setErro(r.erro);
        return;
      }
      setBase({ texto: texto.trim(), nome: nm.trim(), desc: descricao.trim() });
      setOk("Modelo salvo.");
      if (!modelo) router.replace(`/configuracoes/modelos-contrato/${r.cd_modelo}`);
      else router.refresh();
    });
  }

  function testar() {
    if (!modelo || !processoTeste) return;
    setErroPrevia(null);
    setPrevia(null);
    startTestar(async () => {
      const r = await previaDoModelo(modelo.cd_modelo, processoTeste);
      if ("erro" in r) setErroPrevia(r.erro);
      else setPrevia(r.texto);
    });
  }

  function pedirIA(modo: "campos" | "instrucao") {
    if (!editor) return;
    setErroIA(null);
    setSugestoes(null);
    setOk(null);
    setErro(null);
    setConvite(false);
    const atual = docParaTexto(editor.getJSON() as DocMinuta);
    startConsulta(async () => {
      const r = await sugerirComIA(atual, modo, instrucao);
      if ("erro" in r) {
        setErroIA(r.erro);
        return;
      }
      setSugestoes({ edicoes: r.edicoes, avisos: r.avisos });
      setMarcadas(new Set(r.edicoes.map((_, i) => i)));
    });
  }

  function alternarMarca(i: number) {
    setMarcadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(i)) novo.delete(i);
      else novo.add(i);
      return novo;
    });
  }

  function aplicarSugestoes() {
    if (!editor || !sugestoes) return;
    const escolhidas = sugestoes.edicoes.filter((_, i) => marcadas.has(i));
    // Aplica sobre o texto de AGORA (a pessoa pode ter editado enquanto a IA trabalhava).
    const r = aplicarEdicoesModelo(docParaTexto(editor.getJSON() as DocMinuta), escolhidas);
    if (r.aplicadas === 0) {
      setErroIA("Nenhuma das sugestões escolhidas se aplica ao texto atual (ele mudou). Peça de novo.");
      return;
    }
    editor.commands.setContent(textoParaDoc(r.texto));
    setTexto(docParaTexto(editor.getJSON() as DocMinuta));
    setSugestoes(null);
    setErroIA(null);
    setOk(`${r.aplicadas} mudança(s) aplicada(s). Confira o texto (Ctrl+Z desfaz) e clique em Salvar.`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/configuracoes/modelos-contrato"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Todos os modelos
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {modelo && <AtivoBadge ativo={modelo.sn_ativo} />}
          {modelo && (
            <span className="text-xs text-muted-foreground">
              Versão {modelo.nr_versao} · atualizado em {formatarData(modelo.ts_atualizacao)}
            </span>
          )}
          {editavel && (
            <Button type="button" onClick={salvar} disabled={salvando || !alterado || nm.trim().length < 2}>
              {salvando ? "Salvando..." : modelo ? "Salvar alterações" : "Criar modelo"}
            </Button>
          )}
        </div>
      </div>

      {editavel && convite && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-radius border border-violet-300 bg-violet-50 p-3">
          <p className="max-w-2xl text-sm text-violet-950">
            <strong>Contrato importado.</strong> Se ele ainda traz os dados de um caso real (nomes, CPF, valores,
            datas), a IA troca tudo pelos campos do processo — você revisa antes de aplicar.
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" className="gap-1.5" disabled={consultando} onClick={() => pedirIA("campos")}>
              <Sparkles className="h-3.5 w-3.5" />
              Trocar dados por campos
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConvite(false)}>
              Agora não
            </Button>
          </div>
        </div>
      )}

      {!editavel && (
        <p className="rounded-radius border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          Você tem acesso de leitura: dá para revisar o texto, mas só Master e Jurídico alteram modelos.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nm-modelo">Nome do modelo</Label>
          <Input
            id="nm-modelo"
            value={nm}
            onChange={(e) => setNm(e.target.value)}
            disabled={!editavel}
            maxLength={120}
            placeholder="Ex: Compra e venda — financiamento bancário"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ds-modelo">Quando usar (opcional)</Label>
          <Input
            id="ds-modelo"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            disabled={!editavel}
            placeholder="Ex: venda com financiamento, 1 ou 2 vendedores"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-radius border border-border bg-card p-1">
            {editor && editavel && (
              <>
                <Botao titulo="Desfazer (Ctrl+Z)" desabilitado={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
                  <Undo2 className="h-4 w-4" />
                </Botao>
                <Botao titulo="Refazer (Ctrl+Y)" desabilitado={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
                  <Redo2 className="h-4 w-4" />
                </Botao>
                <span className="mx-1 h-5 w-px bg-border" />
                <Botao titulo="Localizar e substituir" onClick={() => setMostrarLocalizar((v) => !v)}>
                  <Replace className="h-4 w-4" />
                </Botao>
              </>
            )}
            <button
              type="button"
              onClick={() => setMostrarVersoes((v) => !v)}
              className="ml-auto inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs text-foreground hover:bg-muted"
            >
              <History className="h-3.5 w-3.5" />
              Versões ({versoes.length + (modelo ? 1 : 0)})
            </button>
          </div>

          {mostrarLocalizar && editavel && (
            <div className="flex flex-wrap items-end gap-2 rounded-radius border border-border bg-card p-2">
              <div className="flex flex-col gap-1">
                <Label htmlFor="loc-de" className="text-xs">Localizar</Label>
                <Input id="loc-de" value={localizar} onChange={(e) => setLocalizar(e.target.value)} className="h-8 w-48" />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="loc-para" className="text-xs">Substituir por</Label>
                <Input id="loc-para" value={substituir} onChange={(e) => setSubstituir(e.target.value)} className="h-8 w-48" />
              </div>
              <Button type="button" size="sm" variant="outline" onClick={substituirTudo} disabled={!localizar}>
                Substituir tudo
              </Button>
            </div>
          )}

          {mostrarVersoes && (
            <div className="rounded-radius border border-border bg-card p-2 text-sm">
              {modelo && (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  Versão {modelo.nr_versao} (atual) — salva em {formatarData(modelo.ts_atualizacao)}
                </p>
              )}
              {versoes.length === 0 ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  Ainda não há versões anteriores: cada vez que o texto muda, a versão antiga fica guardada aqui.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {versoes.map((v) => (
                    <li key={v.cd_versao} className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5 first:border-t-0">
                      <span className="text-xs text-foreground">
                        Versão {v.nr_versao} · {formatarData(v.ts_criacao)}
                      </span>
                      {editavel && (
                        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => carregarVersao(v)}>
                          Carregar no editor
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {consultando && (
            <p className="flex items-center gap-2 rounded-radius border border-border bg-card p-3 text-sm text-foreground">
              <Sparkles className="h-4 w-4 animate-pulse text-accent" />
              A IA está lendo o contrato... isso leva cerca de 30 segundos.
            </p>
          )}

          {sugestoes && (
            <div className="flex flex-col gap-2 rounded-radius border border-violet-300 bg-card p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-accent" />
                  {sugestoes.edicoes.length === 0
                    ? "A IA não encontrou nada para mudar"
                    : `${sugestoes.edicoes.length} sugestão(ões) da IA — revise e aplique`}
                </p>
                <button type="button" onClick={() => setSugestoes(null)} className="text-xs text-muted-foreground underline">
                  descartar
                </button>
              </div>

              {sugestoes.edicoes.length > 0 && (
                <>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <button type="button" className="text-brand underline" onClick={() => setMarcadas(new Set(sugestoes.edicoes.map((_, i) => i)))}>
                      Marcar todas
                    </button>
                    <button type="button" className="text-brand underline" onClick={() => setMarcadas(new Set())}>
                      Desmarcar todas
                    </button>
                    <span className="text-muted-foreground">{marcadas.size} marcada(s)</span>
                  </div>
                  <ul className="max-h-[360px] overflow-auto rounded-radius border border-border">
                    {sugestoes.edicoes.map((e, i) => (
                      <li key={i} className="flex gap-2 border-t border-border px-2 py-2 first:border-t-0">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 shrink-0"
                          checked={marcadas.has(i)}
                          onChange={() => alternarMarca(i)}
                          aria-label={`Aplicar: ${e.motivo || e.trecho}`}
                        />
                        <div className="min-w-0 text-xs">
                          <p className="text-muted-foreground">
                            {e.motivo}
                            {e.todas && e.ocorrencias > 1 ? ` · troca as ${e.ocorrencias} ocorrências` : ""}
                          </p>
                          {e.tipo === "inserir_apos" ? (
                            <>
                              <p className="text-muted-foreground">
                                Depois de “…{e.trecho.slice(-90)}”
                              </p>
                              <p className="whitespace-pre-wrap rounded bg-sky-50 px-1 text-sky-900">{e.novo.trim()}</p>
                            </>
                          ) : (
                            <p className="break-words">
                              <span className="rounded bg-red-50 px-1 text-red-700 line-through">{e.trecho.slice(0, 220)}</span>
                              {e.tipo === "substituir" && (
                                <>
                                  {" "}→{" "}
                                  <span className="rounded bg-sky-50 px-1 text-sky-900">{e.novo.slice(0, 260)}</span>
                                </>
                              )}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" onClick={aplicarSugestoes} disabled={marcadas.size === 0}>
                      Aplicar {marcadas.size} sugestão(ões)
                    </Button>
                    <span className="text-xs text-muted-foreground">Nada é salvo até você clicar em Salvar.</span>
                  </div>
                </>
              )}

              {sugestoes.avisos.length > 0 && (
                <details className="rounded-radius border border-dashed border-border p-2">
                  <summary className="cursor-pointer text-xs font-medium text-foreground">
                    Observações da IA ({sugestoes.avisos.length})
                  </summary>
                  <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">
                    {sugestoes.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {erroIA && <p className="text-sm text-status-reprovado">{erroIA}</p>}

          <div className="max-h-[720px] overflow-auto rounded-radius border border-border bg-white p-8 font-serif text-[13px] leading-relaxed text-black shadow-inner">
            <EditorContent editor={editor} />
          </div>

          {problemas.length > 0 ? (
            <div className="rounded-radius border border-status-reprovado/40 bg-status-reprovado/10 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-status-reprovado">
                <AlertTriangle className="h-3.5 w-3.5" />
                {problemas.length} ponto(s) para conferir antes de usar
              </p>
              <ul className="list-disc pl-5 text-xs text-status-reprovado">
                {problemas.map((p, i) => (
                  <li key={i}>{p.texto}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-status-aceito" />
              Campos e blocos conferidos: nenhum problema encontrado.
            </p>
          )}

          {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
          {ok && <p className="text-sm text-status-aceito">{ok}</p>}

          <p className="text-xs text-muted-foreground">
            O texto é o que vale: título, cláusulas (&quot;CLÁUSULA…&quot;) e PROMITENTE/LOCADOR em negrito, nomes
            sublinhados e valores do processo em vermelho são aplicados sozinhos ao gerar a minuta. Em{" "}
            <span className="rounded bg-sky-100 px-0.5 text-sky-800">azul</span> os campos preenchidos pelo processo; em{" "}
            <span className="rounded bg-violet-100 px-0.5 text-violet-700">roxo</span> os blocos que só entram se houver o dado.
          </p>
        </div>

        <aside className="flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:self-start lg:overflow-auto">
          {editavel && (
            <div className="flex flex-col gap-2 rounded-radius border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">Campos do processo</p>
              <p className="text-xs text-muted-foreground">
                Clique para colocar no texto, onde está o cursor. O que o processo não tiver vira ________ na minuta.
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar campo..." className="h-8 pl-7 text-xs" />
              </div>
              <div className="flex max-h-[360px] flex-col gap-2 overflow-auto pr-1">
                {grupos.map((g) => (
                  <div key={g.grupo}>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.grupo}</p>
                    <ul className="flex flex-col gap-0.5">
                      {g.campos.map((c) => {
                        const insere = !c.token.includes("...");
                        return (
                          <li key={c.token}>
                            <button
                              type="button"
                              disabled={!insere}
                              onClick={() => inserir(c.token)}
                              title={c.descricao}
                              className={cn(
                                "w-full rounded px-1.5 py-1 text-left text-xs",
                                insere ? "hover:bg-muted" : "cursor-default opacity-70"
                              )}
                            >
                              <code className="text-sky-800">{c.token}</code>
                              <span className="block text-[11px] leading-tight text-muted-foreground">{c.descricao}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                {grupos.length === 0 && <p className="text-xs text-muted-foreground">Nenhum campo com esse termo.</p>}
              </div>
            </div>
          )}

          {editavel && (
            <div className="flex flex-col gap-2 rounded-radius border border-border bg-card p-3">
              <p className="text-sm font-medium text-foreground">Trecho condicional</p>
              <p className="text-xs text-muted-foreground">
                Selecione um trecho do texto e escolha quando ele entra no contrato.
              </p>
              <select
                value={blocoCampo}
                onChange={(e) => setBlocoCampo(e.target.value)}
                className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground"
                aria-label="Campo que decide se o trecho entra"
              >
                {CAMPOS_DE_BLOCO.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={() => envolver("#")}>
                  Só se existir
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={() => envolver("^")}>
                  Só se não existir
                </Button>
              </div>
            </div>
          )}

          {editavel && (
            <div className="flex flex-col gap-2 rounded-radius border border-violet-300 bg-card p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Sparkles className="h-4 w-4 text-accent" />
                Assistente de IA
              </p>
              <p className="text-xs text-muted-foreground">
                Contrato preenchido de um caso real? A IA acha nomes, CPF, valores, datas e propõe trocar tudo pelos
                campos. Você revisa antes de aplicar.
              </p>
              <Button type="button" size="sm" variant="outline" disabled={consultando} onClick={() => pedirIA("campos")}>
                {consultando ? "A IA está trabalhando..." : "Trocar dados por campos"}
              </Button>
              <Label htmlFor="ia-instrucao" className="mt-1 text-xs">
                Ou peça uma mudança
              </Label>
              <textarea
                id="ia-instrucao"
                value={instrucao}
                onChange={(e) => setInstrucao(e.target.value)}
                rows={4}
                placeholder={'Ex.: "passe o prazo de entrega das chaves para 15 dias" ou "acrescente uma cláusula de multa de 2% por atraso no pagamento"'}
                className="w-full rounded-radius border border-border bg-background px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
              <Button type="button" size="sm" disabled={consultando || !instrucao.trim()} onClick={() => pedirIA("instrucao")}>
                Pedir à IA
              </Button>
            </div>
          )}

          {modelo && processos.length > 0 && (
            <div className="flex flex-col gap-2 rounded-radius border border-border bg-card p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <FlaskConical className="h-4 w-4 text-accent" />
                Testar com um processo
              </p>
              <select
                value={processoTeste}
                onChange={(e) => setProcessoTeste(e.target.value)}
                className="h-8 rounded border border-border bg-background px-2 text-xs text-foreground"
                aria-label="Processo para o teste"
              >
                {processos.map((p) => (
                  <option key={p.cd_processo} value={p.cd_processo}>
                    {p.rotulo}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant="outline" onClick={testar} disabled={testando || alterado}>
                {testando ? "Gerando..." : "Gerar prévia"}
              </Button>
              {alterado && <p className="text-xs text-muted-foreground">Salve o modelo antes: a prévia usa a versão salva.</p>}
              {erroPrevia && <p className="text-xs text-status-reprovado">{erroPrevia}</p>}
            </div>
          )}
        </aside>
      </div>

      {previa && (
        <div className="flex flex-col gap-2 rounded-radius border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Prévia com o processo escolhido</p>
            <button type="button" onClick={() => setPrevia(null)} className="text-xs text-muted-foreground underline">
              fechar
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Em <span className="font-semibold text-status-reprovado">vermelho</span>: o que veio dos dados do processo; os{" "}
            ________ são o que falta preencher.
          </p>
          <div className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-radius border border-border bg-white p-6 font-serif text-[13px] leading-relaxed text-black">
            {renderMarcado(previa)}
          </div>
        </div>
      )}
    </div>
  );
}

