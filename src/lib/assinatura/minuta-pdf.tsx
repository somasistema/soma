import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { textoParaDoc, type DocMinuta, type DocNo } from "@/lib/minuta-doc";
import { dividirLacunas } from "@/lib/minuta-lacunas";

const VERMELHO = "#dc2626";

const styles = StyleSheet.create({
  page: { paddingVertical: 56, paddingHorizontal: 64, fontSize: 11, lineHeight: 1.6 },
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

const FONTES: Record<string, string> = {
  n: "Helvetica",
  b: "Helvetica-Bold",
  i: "Helvetica-Oblique",
  bi: "Helvetica-BoldOblique",
};

type Opcoes = {
  // Versão de conferência: valores vindos do processo e lacunas do modelo
  // (XXXX, 0000, [campo]) em vermelho, como na tela. O PDF que vai pra
  // assinatura sai sem as cores.
  destacar?: boolean;
};

function trecho(no: DocNo, chave: number, { destacar }: Opcoes): ReactNode {
  if (no.type === "hardBreak") return <Text key={chave}>{"\n"}</Text>;
  if (no.type !== "text") return null;
  const marcas = new Set((no.marks ?? []).map((m) => m.type));
  const valor = Boolean(destacar) && marcas.has("valor");
  const negrito = marcas.has("bold") || valor;
  const fonte = FONTES[(negrito ? "b" : "") + (marcas.has("italic") ? "i" : "") || "n"];
  const decoracao =
    marcas.has("underline") && marcas.has("strike")
      ? "underline line-through"
      : marcas.has("underline")
        ? "underline"
        : marcas.has("strike")
          ? "line-through"
          : "none";
  const estilo = (no.marks ?? []).find((m) => m.type === "textStyle")?.attrs;
  const corEscolhida = typeof estilo?.color === "string" ? estilo.color : undefined;
  const cor = corEscolhida ?? (valor ? VERMELHO : undefined);
  const fundo = typeof estilo?.backgroundColor === "string" ? estilo.backgroundColor : undefined;

  const base = {
    fontFamily: fonte,
    textDecoration: decoracao,
    ...(cor ? { color: cor } : {}),
    ...(fundo ? { backgroundColor: fundo } : {}),
  } as const;

  // Lacunas dentro do texto corrido também ficam em vermelho.
  if (destacar && !valor) {
    const partes = dividirLacunas(no.text ?? "");
    if (partes.some((p) => p.lacuna)) {
      return (
        <Text key={chave} style={base}>
          {partes.map((p, i) =>
            p.lacuna ? (
              <Text key={i} style={{ fontFamily: FONTES[marcas.has("italic") ? "bi" : "b"], color: VERMELHO }}>
                {p.texto}
              </Text>
            ) : (
              p.texto
            )
          )}
        </Text>
      );
    }
  }

  return (
    <Text key={chave} style={base}>
      {no.text}
    </Text>
  );
}

function alinha(no: DocNo): "left" | "center" | "right" | "justify" {
  const a = no.attrs?.textAlign;
  return a === "center" || a === "right" || a === "justify" ? a : "left";
}

function blocoPdf(no: DocNo, chave: number, opcoes: Opcoes): ReactNode {
  if (no.type === "bulletList" || no.type === "orderedList") {
    return (
      <View key={chave} style={{ marginBottom: 8 }}>
        {(no.content ?? []).map((item, i) => (
          <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
            <Text style={{ width: 18 }}>{no.type === "bulletList" ? "•" : `${i + 1}.`}</Text>
            <View style={{ flex: 1 }}>{(item.content ?? []).map((n, j) => blocoPdf(n, j, opcoes))}</View>
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
        {(no.content ?? []).length > 0 ? (no.content ?? []).map((n, i) => trecho(n, i, opcoes)) : " "}
      </Text>
    </View>
  );
}

export async function minutaDocParaPdf(doc: DocMinuta, opcoes: Opcoes = {}): Promise<Buffer> {
  return renderToBuffer(
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {(doc.content ?? []).map((no, i) => blocoPdf(no, i, opcoes))}
        <Text
          style={styles.rodape}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}

// PDF da minuta gerada de modelo: do documento do editor, ou do texto (que vira
// documento com título/cláusulas em destaque e parágrafos). Null se a minuta é
// um arquivo enviado — aí o PDF é o próprio arquivo.
export async function minutaParaPdf(
  minuta: { ds_conteudo: string | null; ds_conteudo_json: DocMinuta | null },
  opcoes: Opcoes = {}
): Promise<Buffer | null> {
  const doc = minuta.ds_conteudo_json ?? (minuta.ds_conteudo ? textoParaDoc(minuta.ds_conteudo) : null);
  return doc ? minutaDocParaPdf(doc, opcoes) : null;
}
