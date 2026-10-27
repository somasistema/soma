import type { ReactNode } from "react";
import type { DocMinuta, DocNo } from "@/lib/minuta-doc";
import { dividirLacunas } from "@/lib/minuta-lacunas";

// Leitura da minuta editada (JSON do editor) — mesmo visual de papel do
// editor, valores do processo em vermelho.
function inline(no: DocNo, chave: number): ReactNode {
  if (no.type === "hardBreak") return <br key={chave} />;
  if (no.type !== "text") return null;
  // Lacunas do modelo (XXXX, 0000...) em vermelho, pra ninguém esquecer.
  let el: ReactNode = dividirLacunas(no.text ?? "").map((t, i) =>
    t.lacuna ? (
      <span key={i} className="font-semibold text-red-600">
        {t.texto}
      </span>
    ) : (
      t.texto
    )
  );
  // textStyle (cor escolhida) por dentro, pra valer sobre o vermelho do "valor".
  const marcas = [...(no.marks ?? [])].sort(
    (a, b) => Number(b.type === "textStyle") - Number(a.type === "textStyle")
  );
  for (const m of marcas) {
    if (m.type === "bold") el = <strong>{el}</strong>;
    else if (m.type === "italic") el = <em>{el}</em>;
    else if (m.type === "underline") el = <u>{el}</u>;
    else if (m.type === "strike") el = <s>{el}</s>;
    else if (m.type === "textStyle") {
      const cor = m.attrs?.color;
      const fundo = m.attrs?.backgroundColor;
      el = (
        <span
          style={{
            color: typeof cor === "string" ? cor : undefined,
            backgroundColor: typeof fundo === "string" ? fundo : undefined,
          }}
        >
          {el}
        </span>
      );
    } else if (m.type === "valor") el = <span className="font-semibold text-red-600">{el}</span>;
  }
  return <span key={chave}>{el}</span>;
}

function alinhamento(no: DocNo) {
  const a = no.attrs?.textAlign;
  return typeof a === "string" ? (a as "left" | "center" | "right" | "justify") : undefined;
}

function bloco(no: DocNo, chave: number): ReactNode {
  const filhos = (no.content ?? []).map(inline);
  const style = { textAlign: alinhamento(no) };
  switch (no.type) {
    case "heading": {
      const nivel = Number(no.attrs?.level ?? 2);
      const classe = nivel === 1 ? "text-xl" : nivel === 2 ? "text-lg" : "text-base";
      return (
        <p key={chave} style={style} className={`mb-2 font-bold ${classe}`}>
          {filhos}
        </p>
      );
    }
    case "bulletList":
    case "orderedList": {
      const Lista = no.type === "bulletList" ? "ul" : "ol";
      return (
        <Lista
          key={chave}
          className={`mb-2 pl-6 ${no.type === "bulletList" ? "list-disc" : "list-decimal"}`}
        >
          {(no.content ?? []).map((item, i) => (
            <li key={i}>{(item.content ?? []).map(bloco)}</li>
          ))}
        </Lista>
      );
    }
    default:
      return (
        <p key={chave} style={style} className="mb-2 min-h-[1em]">
          {filhos}
        </p>
      );
  }
}

export function MinutaDocView({ doc }: { doc: DocMinuta }) {
  return (
    <div className="max-h-[600px] overflow-auto rounded-radius border border-border bg-white p-6 font-serif text-[13px] leading-relaxed text-black">
      {(doc.content ?? []).map(bloco)}
    </div>
  );
}
