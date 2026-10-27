import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import type { DocMinuta, DocNo } from "@/lib/minuta-doc";

const styles = StyleSheet.create({
  page: { paddingVertical: 56, paddingHorizontal: 64, fontSize: 11, lineHeight: 1.6 },
  titulo: { fontSize: 14, marginBottom: 18, textAlign: "center", fontFamily: "Helvetica-Bold" },
  paragrafo: { marginBottom: 8, textAlign: "justify" },
  rodape: {
    position: "absolute",
    bottom: 28,
    left: 64,
    right: 64,
    fontSize: 8,
    color: "#666",
    textAlign: "center",
  },
});

function MinutaDoc({ titulo, texto }: { titulo: string; texto: string }) {
  const blocos = texto.split(/\n{2,}/);
  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.titulo}>{titulo}</Text>
        {blocos.map((bloco, i) => (
          <View key={i} style={styles.paragrafo}>
            <Text>{bloco.replace(/\n/g, " ").trim()}</Text>
          </View>
        ))}
        <Text
          style={styles.rodape}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

// Gera o PDF da minuta que veio como texto (minuta feita a partir de
// um modelo — ver migration 043). Minuta que já é arquivo não passa
// por aqui.
export async function minutaTextoParaPdf(titulo: string, texto: string): Promise<Buffer> {
  return renderToBuffer(<MinutaDoc titulo={titulo} texto={texto} />);
}

// ---- Minuta editada (JSON do editor) -> PDF, com a formatação do editor.
const FONTES: Record<string, string> = {
  n: "Helvetica",
  b: "Helvetica-Bold",
  i: "Helvetica-Oblique",
  bi: "Helvetica-BoldOblique",
};

function trecho(no: DocNo, chave: number): ReactNode {
  if (no.type === "hardBreak") return <Text key={chave}>{"\n"}</Text>;
  if (no.type !== "text") return null;
  const marcas = new Set((no.marks ?? []).map((m) => m.type));
  const fonte =
    FONTES[(marcas.has("bold") ? "b" : "") + (marcas.has("italic") ? "i" : "") || "n"];
  const decoracao =
    marcas.has("underline") && marcas.has("strike")
      ? "underline line-through"
      : marcas.has("underline")
        ? "underline"
        : marcas.has("strike")
          ? "line-through"
          : "none";
  const estilo = (no.marks ?? []).find((m) => m.type === "textStyle")?.attrs;
  const cor = typeof estilo?.color === "string" ? estilo.color : undefined;
  const fundo = typeof estilo?.backgroundColor === "string" ? estilo.backgroundColor : undefined;
  return (
    <Text
      key={chave}
      style={{
        fontFamily: fonte,
        textDecoration: decoracao,
        ...(cor ? { color: cor } : {}),
        ...(fundo ? { backgroundColor: fundo } : {}),
      }}
    >
      {no.text}
    </Text>
  );
}

function alinha(no: DocNo): "left" | "center" | "right" | "justify" {
  const a = no.attrs?.textAlign;
  return a === "center" || a === "right" || a === "justify" ? a : "left";
}

function blocoPdf(no: DocNo, chave: number): ReactNode {
  if (no.type === "bulletList" || no.type === "orderedList") {
    return (
      <View key={chave} style={{ marginBottom: 8 }}>
        {(no.content ?? []).map((item, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
            <Text style={{ width: 18 }}>{no.type === "bulletList" ? "•" : `${i + 1}.`}</Text>
            <View style={{ flex: 1 }}>{(item.content ?? []).map(blocoPdf)}</View>
          </View>
        ))}
      </View>
    );
  }
  const heading = no.type === "heading";
  const nivel = Number(no.attrs?.level ?? 2);
  return (
    <View key={chave} style={styles.paragrafo}>
      <Text
        style={{
          textAlign: alinha(no),
          ...(heading ? { fontFamily: "Helvetica-Bold", fontSize: nivel === 1 ? 15 : nivel === 2 ? 13 : 11 } : {}),
        }}
      >
        {(no.content ?? []).length > 0 ? (no.content ?? []).map(trecho) : " "}
      </Text>
    </View>
  );
}

export async function minutaDocParaPdf(doc: DocMinuta): Promise<Buffer> {
  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {(doc.content ?? []).map(blocoPdf)}
        <Text
          style={styles.rodape}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
