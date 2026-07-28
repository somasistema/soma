import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { TIPO_PROCESSO_LABEL, type OrcamentoServico, type TipoProcesso } from "@/types/database";
import { TERMO_DESPACHANTE_INTRO, TERMO_DESPACHANTE_TITULO } from "@/lib/termo-despachante";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR");
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1a1a1a" },
  marca: { fontSize: 20, fontWeight: 700, color: "#1a2b4a", marginBottom: 2 },
  subMarca: { fontSize: 9, color: "#b08d3e", letterSpacing: 1, marginBottom: 16 },
  titulo: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  linhaInfo: { fontSize: 10, color: "#555", marginBottom: 2 },
  secao: { marginTop: 20, marginBottom: 8, fontSize: 11, fontWeight: 700 },
  tabela: { display: "flex", flexDirection: "column", borderTop: "1px solid #ddd" },
  linhaTabela: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1px solid #eee",
    paddingVertical: 6,
  },
  cabecalhoTabela: {
    display: "flex",
    flexDirection: "row",
    borderBottom: "1px solid #ddd",
    paddingBottom: 6,
    fontWeight: 700,
    color: "#555",
  },
  colDescricao: { flex: 3 },
  colTipo: { flex: 1 },
  colQtd: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1.5, textAlign: "right" },
  colSubtotal: { flex: 1.5, textAlign: "right" },
  totais: { marginTop: 12, alignItems: "flex-end" },
  totalGeral: { fontSize: 13, fontWeight: 700, marginTop: 4 },
  termoTitulo: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  termoTexto: { fontSize: 8, color: "#555", lineHeight: 1.4 },
  rodape: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#999" },
});

export interface OrcamentoPdfProps {
  numeroProcesso: string;
  tipoProcesso: TipoProcesso;
  nomeCidade: string;
  dataValidade: string;
  nomeComprador: string | null;
  itens: OrcamentoServico[];
  vlTotalHonorarios: number;
  vlTotalCustas: number;
  vlTotalGeral: number;
}

export function OrcamentoPdf({
  numeroProcesso,
  tipoProcesso,
  nomeCidade,
  dataValidade,
  nomeComprador,
  itens,
  vlTotalHonorarios,
  vlTotalCustas,
  vlTotalGeral,
}: OrcamentoPdfProps) {
  return (
    <Document title={`Orçamento ${numeroProcesso}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.marca}>SOMA</Text>
        <Text style={styles.subMarca}>ASSESSORIA IMOBILIÁRIA</Text>

        <Text style={styles.titulo}>Orçamento de Serviços — Processo {numeroProcesso}</Text>
        <Text style={styles.linhaInfo}>Tipo: {TIPO_PROCESSO_LABEL[tipoProcesso]}</Text>
        <Text style={styles.linhaInfo}>Cidade: {nomeCidade}</Text>
        {nomeComprador && <Text style={styles.linhaInfo}>Comprador: {nomeComprador}</Text>}
        <Text style={styles.linhaInfo}>Válido até: {formatarData(dataValidade)}</Text>

        <Text style={styles.secao}>Itens do orçamento</Text>
        <View style={styles.tabela}>
          <View style={styles.cabecalhoTabela}>
            <Text style={styles.colDescricao}>Serviço</Text>
            <Text style={styles.colTipo}>Tipo</Text>
            <Text style={styles.colQtd}>Qtd.</Text>
            <Text style={styles.colUnit}>Valor unit.</Text>
            <Text style={styles.colSubtotal}>Subtotal</Text>
          </View>
          {itens.map((item) => (
            <View key={item.cd_orcamento_servico} style={styles.linhaTabela}>
              <Text style={styles.colDescricao}>{item.ds_descricao}</Text>
              <Text style={styles.colTipo}>{item.tp_servico === "honorario" ? "Honorário" : "Custa"}</Text>
              <Text style={styles.colQtd}>{item.nr_quantidade}</Text>
              <Text style={styles.colUnit}>{formatarMoeda(item.vl_unitario)}</Text>
              <Text style={styles.colSubtotal}>{formatarMoeda(item.vl_subtotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totais}>
          <Text>Honorários: {formatarMoeda(vlTotalHonorarios)}</Text>
          <Text>Custas: {formatarMoeda(vlTotalCustas)}</Text>
          <Text style={styles.totalGeral}>Total: {formatarMoeda(vlTotalGeral)}</Text>
        </View>

        <Text style={{ ...styles.secao, marginTop: 28 }}>{TERMO_DESPACHANTE_TITULO}</Text>
        <Text style={styles.termoTexto}>
          {TERMO_DESPACHANTE_INTRO} O texto completo do Termo de Ciência e Aceite dos Serviços de
          Despachante é apresentado ao comprador no momento do aceite eletrônico deste orçamento,
          cujo registro (data, hora e itens efetivamente aceitos) fica armazenado como evidência
          jurídica do aceite.
        </Text>

        <Text style={styles.rodape}>
          SOMA Assessoria Imobiliária — Documento gerado eletronicamente, sem necessidade de
          assinatura manuscrita.
        </Text>
      </Page>
    </Document>
  );
}
