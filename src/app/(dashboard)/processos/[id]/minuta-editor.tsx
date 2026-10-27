"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, Extension, Mark, useEditor, type Editor } from "@tiptap/react";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { BackgroundColor, Color, TextStyle } from "@tiptap/extension-text-style";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LACUNA } from "@/lib/minuta-lacunas";
import type { DocMinuta } from "@/lib/minuta-doc";
import { editarMinuta } from "./minuta-actions";

// Trecho que veio dos dados do processo (vermelho). Não "gruda": quem
// digita ao lado não herda a cor.
const Valor = Mark.create({
  name: "valor",
  inclusive: false,
  // Fica por fora da cor escolhida pelo usuário: a cor dele vale sobre o vermelho.
  priority: 1000,
  parseHTML() {
    return [{ tag: "span[data-valor]" }];
  },
  renderHTML() {
    return [
      "span",
      { "data-valor": "", class: "font-semibold text-red-600", style: "color:#dc2626;font-weight:600" },
      0,
    ];
  },
});

// Lacunas do modelo (XXXX, 0000, [DADOS DO IMÓVEL]...) em vermelho enquanto
// existirem — é só visual (decoração), não entra no texto salvo.
const DestacarLacunas = Extension.create({
  name: "destacarLacunas",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((no, pos) => {
              if (!no.isText || !no.text) return;
              for (const m of no.text.matchAll(LACUNA)) {
                const de = pos + (m.index ?? 0);
                decos.push(
                  Decoration.inline(de, de + m[0].length, {
                    class: "font-semibold text-red-600",
                  })
                );
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
  ativo,
  desabilitado,
  onClick,
  children,
}: {
  titulo: string;
  ativo?: boolean;
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
      // mousedown: não tira o foco/seleção do texto
      onMouseDown={(e) => {
        e.preventDefault();
        if (!desabilitado) onClick();
      }}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded text-foreground hover:bg-muted disabled:opacity-40",
        ativo && "bg-muted text-brand"
      )}
    >
      {children}
    </button>
  );
}

const CORES = [
  "#000000", "#434343", "#666666", "#999999", "#dc2626", "#ea580c", "#ca8a04", "#16a34a",
  "#0891b2", "#2563eb", "#7c3aed", "#db2777",
];
const REALCES = [
  "#fef08a", "#bbf7d0", "#bae6fd", "#fbcfe8", "#fed7aa", "#e9d5ff", "#e5e7eb", "#fecaca",
];

// Seletor de cor (letra ou marca-texto), como o do Word: paleta, cor
// personalizada e "automática" (remove a cor).
function SeletorCor({
  titulo,
  icone,
  atual,
  paleta,
  onEscolher,
  onLimpar,
}: {
  titulo: string;
  icone: React.ReactNode;
  atual: string | null;
  paleta: string[];
  onEscolher: (cor: string) => void;
  onLimpar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={titulo}
        aria-label={titulo}
        aria-expanded={aberto}
        onMouseDown={(e) => {
          e.preventDefault();
          setAberto((v) => !v);
        }}
        className="inline-flex h-8 w-8 flex-col items-center justify-center rounded text-foreground hover:bg-muted"
      >
        {icone}
        <span
          className="mt-0.5 h-1 w-4 rounded-sm border border-border"
          style={{ background: atual ?? "transparent" }}
        />
      </button>
      {aberto && (
        <div className="absolute left-0 top-9 z-20 w-48 rounded-radius border border-border bg-card p-2 shadow-lg">
          <div className="grid grid-cols-6 gap-1">
            {paleta.map((cor) => (
              <button
                key={cor}
                type="button"
                title={cor}
                aria-label={cor}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onEscolher(cor);
                  setAberto(false);
                }}
                className="h-6 w-6 rounded border border-border"
                style={{ background: cor }}
              />
            ))}
          </div>
          <label className="mt-2 flex items-center justify-between gap-2 text-xs text-foreground">
            Outra cor
            <input
              type="color"
              value={atual ?? "#000000"}
              onChange={(e) => onEscolher(e.target.value)}
              className="h-6 w-10 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              onLimpar();
              setAberto(false);
            }}
            className="mt-2 w-full rounded border border-border py-1 text-xs text-foreground hover:bg-muted"
          >
            Sem cor (automática)
          </button>
        </div>
      )}
    </div>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px bg-border" />;

function Barra({ editor }: { editor: Editor }) {
  const estilo =
    editor.isActive("heading", { level: 1 })
      ? "h1"
      : editor.isActive("heading", { level: 2 })
        ? "h2"
        : editor.isActive("heading", { level: 3 })
          ? "h3"
          : "p";

  function trocarEstilo(valor: string) {
    const c = editor.chain().focus();
    if (valor === "p") c.setParagraph().run();
    else c.setHeading({ level: Number(valor[1]) as 1 | 2 | 3 }).run();
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-radius border border-border bg-card p-1">
      <Botao titulo="Desfazer (Ctrl+Z)" desabilitado={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <Undo2 className="h-4 w-4" />
      </Botao>
      <Botao titulo="Refazer (Ctrl+Y)" desabilitado={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <Redo2 className="h-4 w-4" />
      </Botao>
      <Sep />
      <select
        aria-label="Estilo do parágrafo"
        value={estilo}
        onChange={(e) => trocarEstilo(e.target.value)}
        className="h-8 rounded border border-border bg-background px-2 text-sm text-foreground"
      >
        <option value="p">Texto normal</option>
        <option value="h1">Título 1</option>
        <option value="h2">Título 2</option>
        <option value="h3">Título 3</option>
      </select>
      <Sep />
      <Botao titulo="Negrito (Ctrl+B)" ativo={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </Botao>
      <Botao titulo="Itálico (Ctrl+I)" ativo={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </Botao>
      <Botao titulo="Sublinhado (Ctrl+U)" ativo={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </Botao>
      <SeletorCor
        titulo="Cor da letra"
        icone={<span className="text-sm font-bold leading-none">A</span>}
        atual={(editor.getAttributes("textStyle").color as string | undefined) ?? null}
        paleta={CORES}
        onEscolher={(cor) => editor.chain().focus().setColor(cor).run()}
        onLimpar={() => editor.chain().focus().unsetColor().run()}
      />
      <SeletorCor
        titulo="Cor de destaque (marca-texto)"
        icone={<Highlighter className="h-3.5 w-3.5" />}
        atual={(editor.getAttributes("textStyle").backgroundColor as string | undefined) ?? null}
        paleta={REALCES}
        onEscolher={(cor) => editor.chain().focus().setBackgroundColor(cor).run()}
        onLimpar={() => editor.chain().focus().unsetBackgroundColor().run()}
      />
      <Sep />
      <Botao titulo="Alinhar à esquerda" ativo={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <AlignLeft className="h-4 w-4" />
      </Botao>
      <Botao titulo="Centralizar" ativo={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <AlignCenter className="h-4 w-4" />
      </Botao>
      <Botao titulo="Alinhar à direita" ativo={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <AlignRight className="h-4 w-4" />
      </Botao>
      <Botao titulo="Justificar" ativo={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>
        <AlignJustify className="h-4 w-4" />
      </Botao>
      <Sep />
      <Botao titulo="Lista com marcadores" ativo={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </Botao>
      <Botao titulo="Lista numerada" ativo={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </Botao>
    </div>
  );
}

// Editor da minuta, no estilo do Word. A minuta gerada de modelo (só
// texto) é convertida pra documento na hora de abrir; ao salvar vira uma
// nova versão e as 5 aprovações recomeçam.
export function MinutaEditor({ cdMinuta, doc }: { cdMinuta: string; doc: DocMinuta }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alterado, setAlterado] = useState(false);
  const [salvando, startSalvar] = useTransition();
  const inicial = useRef("");

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: true,
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
          blockquote: false,
          code: false,
          codeBlock: false,
          horizontalRule: false,
          strike: false,
          link: false,
        }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
        TextStyle,
        Color,
        BackgroundColor,
        Valor,
        DestacarLacunas,
      ],
      content: doc,
      editorProps: {
        attributes: {
          class:
            "min-h-[520px] outline-none [&_p]:mb-2 [&_p]:min-h-[1em] [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:font-bold [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-6",
          spellcheck: "true",
          lang: "pt-BR",
        },
      },
      onCreate: ({ editor: e }) => {
        inicial.current = JSON.stringify(e.getJSON());
      },
      onUpdate: ({ editor: e }) => setAlterado(JSON.stringify(e.getJSON()) !== inicial.current),
    },
    [aberto]
  );

  function abrir() {
    setErro(null);
    setAlterado(false);
    setAberto(true);
  }

  function salvar() {
    if (!editor) return;
    setErro(null);
    startSalvar(async () => {
      const resultado = await editarMinuta(cdMinuta, editor.getJSON() as DocMinuta);
      if (!resultado.sucesso) {
        setErro(resultado.erro);
        return;
      }
      setAberto(false);
      router.refresh();
    });
  }

  if (!aberto) {
    return (
      <div>
        <Button type="button" variant="outline" onClick={abrir}>
          Editar minuta
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-radius border border-border p-3">
      <p className="text-xs text-muted-foreground">
        Edite como no Word. Ao salvar, vira uma <strong>nova versão</strong> da minuta (a anterior
        fica no histórico) e as 5 aprovações recomeçam do zero. Em{" "}
        <span className="font-medium text-red-600">vermelho</span>: o que veio dos dados do
        processo — no PDF sai sem cor.
      </p>
      {editor && <Barra editor={editor} />}
      <div className="max-h-[640px] overflow-auto rounded-radius border border-border bg-white p-8 font-serif text-[13px] leading-relaxed text-black shadow-inner">
        <EditorContent editor={editor} />
      </div>
      {erro && <p className="text-sm text-status-reprovado">{erro}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" onClick={salvar} disabled={salvando || !alterado}>
          {salvando ? "Salvando..." : "Salvar nova versão"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setAberto(false)} disabled={salvando}>
          Cancelar
        </Button>
        {!alterado && <span className="text-xs text-muted-foreground">Nenhuma alteração ainda.</span>}
      </div>
    </div>
  );
}
