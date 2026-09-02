import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

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
