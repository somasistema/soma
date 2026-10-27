// Minuta como documento (editor estilo Word). A minuta nasce como texto
// (fn_render_modelo_contrato) e, quando alguém edita com formatação, é
// guardada também como JSON do editor (TipTap/ProseMirror) em
// minutas.ds_conteudo_json. O texto puro (ds_conteudo, com as marcas
// STX/ETX de "valor vindo do processo") continua sendo gravado junto —
// serve de reserva e pra busca.

const STX = String.fromCharCode(2);
const ETX = String.fromCharCode(3);

export type DocMarca = { type: string; attrs?: Record<string, unknown> };

export type DocNo = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNo[];
  text?: string;
  marks?: DocMarca[];
};

export type DocMinuta = { type: "doc"; content: DocNo[] };

function noTexto(texto: string, valor: boolean, marcas: DocMarca[] = []): DocNo {
  const todas = valor ? [...marcas, { type: "valor" }] : marcas;
  return todas.length > 0 ? { type: "text", text: texto, marks: todas } : { type: "text", text: texto };
}

// Uma linha (sem \n) -> nós de texto, com a marca "valor" nos trechos
// entre STX e ETX.
function linhaParaNos(linha: string, marcas: DocMarca[]): DocNo[] {
  const nos: DocNo[] = [];
  let dentro = false;
  let buffer = "";
  const descarrega = () => {
    if (buffer) nos.push(noTexto(buffer, dentro, marcas));
    buffer = "";
  };
  for (const ch of linha) {
    if (ch === STX) {
      descarrega();
      dentro = true;
    } else if (ch === ETX) {
      descarrega();
      dentro = false;
    } else {
      buffer += ch;
    }
  }
  descarrega();
  return nos;
}

// Parágrafo do texto da minuta -> nó; \n dentro do bloco vira quebra de
// linha (assinaturas, endereços).
function blocoParaParagrafo(bloco: string, marcas: DocMarca[], align?: string): DocNo {
  const linhas = bloco.split("\n");
  const content: DocNo[] = [];
  linhas.forEach((linha, i) => {
    if (i > 0) content.push({ type: "hardBreak" });
    content.push(...linhaParaNos(linha, marcas));
  });
  const no: DocNo = { type: "paragraph", content };
  if (align) no.attrs = { textAlign: align };
  return no;
}

const NEGRITO: DocMarca[] = [{ type: "bold" }];

export function textoParaDoc(texto: string): DocMinuta {
  const blocos = texto
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.replace(/^\n+|\n+$/g, ""))
    .filter((b) => b.trim().length > 0);

  const content = blocos.map((bloco, i) => {
    const limpo = bloco.replace(new RegExp(`[${STX}${ETX}]`, "g"), "").trim();
    // Título do instrumento e cabeçalhos de cláusula, como nos contratos.
    if (i === 0 && limpo.length < 140 && limpo === limpo.toUpperCase()) {
      return blocoParaParagrafo(bloco, NEGRITO, "center");
    }
    if (/^CLÁUSULA\s/.test(limpo) && limpo.length < 160 && !limpo.includes("\n")) {
      return blocoParaParagrafo(bloco, NEGRITO, "center");
    }
    return blocoParaParagrafo(bloco, [], "justify");
  });

  return { type: "doc", content: content.length > 0 ? content : [{ type: "paragraph" }] };
}

function textoDoNo(no: DocNo): string {
  if (no.type === "hardBreak") return "\n";
  if (no.type === "text") {
    const t = no.text ?? "";
    return no.marks?.some((m) => m.type === "valor") ? STX + t + ETX : t;
  }
  return (no.content ?? []).map(textoDoNo).join("");
}

function blocoParaTexto(no: DocNo, prefixo = ""): string[] {
  switch (no.type) {
    case "bulletList":
      return (no.content ?? []).flatMap((item) =>
        (item.content ?? []).map((filho) => "• " + textoDoNo(filho))
      );
    case "orderedList": {
      let n = 0;
      return (no.content ?? []).flatMap((item) =>
        (item.content ?? []).map((filho) => `${++n}. ` + textoDoNo(filho))
      );
    }
    default:
      return [prefixo + textoDoNo(no)];
  }
}

// JSON do editor -> texto puro, com STX/ETX nos valores marcados.
export function docParaTexto(doc: DocMinuta): string {
  const blocos = (doc.content ?? []).flatMap((no) => blocoParaTexto(no));
  return blocos.join("\n\n").trim();
}

// Garante a forma mínima do que veio do navegador antes de gravar.
export function docValido(valor: unknown): valor is DocMinuta {
  if (!valor || typeof valor !== "object") return false;
  const d = valor as { type?: unknown; content?: unknown };
  if (d.type !== "doc" || !Array.isArray(d.content)) return false;
  const tipos = new Set([
    "paragraph", "heading", "bulletList", "orderedList", "listItem", "hardBreak", "text",
  ]);
  const checa = (no: unknown, nivel: number): boolean => {
    if (nivel > 8 || !no || typeof no !== "object") return false;
    const n = no as DocNo;
    if (typeof n.type !== "string" || !tipos.has(n.type)) return false;
    if (n.text !== undefined && typeof n.text !== "string") return false;
    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) return false;
      return n.content.every((f) => checa(f, nivel + 1));
    }
    return true;
  };
  return d.content.length <= 5000 && d.content.every((n) => checa(n, 0));
}
