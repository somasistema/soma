import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { TIPO_PROCESSO_LABEL, type OrcamentoServico, type TipoProcesso } from "@/types/database";
import { TERMO_DESPACHANTE_INTRO, TERMO_DESPACHANTE_TITULO } from "@/lib/termo-despachante";

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarData(data: string) {
  return new Date(data).toLocaleDateString("pt-BR");
}

function subtotalSecao(itens: OrcamentoServico[]) {
  return itens.reduce((total, item) => total + item.vl_subtotal, 0);
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
  subtotalSecao: { marginTop: 6, fontSize: 10, fontWeight: 700, textAlign: "right" },
  totais: { marginTop: 12, alignItems: "flex-end" },
  totalGeral: { fontSize: 13, fontWeight: 700, marginTop: 4 },
  termoTitulo: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  termoTexto: { fontSize: 8, color: "#555", lineHeight: 1.4 },
  observacaoTitulo: { fontSize: 9, fontWeight: 700, marginTop: 10, marginBottom: 2 },
  observacaoTexto: { fontSize: 8, color: "#555", lineHeight: 1.4, marginBottom: 4 },
  rodape: { position: "absolute", bottom: 30, left: 40, right: 40, fontSize: 8, color: "#999" },
});

function TabelaItens({ itens }: { itens: OrcamentoServico[] }) {
  return (
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
      <Text style={styles.subtotalSecao}>Subtotal: {formatarMoeda(subtotalSecao(itens))}</Text>
    </View>
  );
}

export interface OrcamentoPdfProps {
  numeroProcesso: string;
  tipoProcesso: TipoProcesso;
  nomeCidade: string;
  dataValidade: string;
  nomeComprador: string | null;
  dsInscricaoMunicipal: string | null;
  vlTransacao: number | null;
  vlVenal: number | null;
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
  dsInscricaoMunicipal,
  vlTransacao,
  vlVenal,
  itens,
  vlTotalHonorarios,
  vlTotalCustas,
  vlTotalGeral,
}: OrcamentoPdfProps) {
  const itensIniciais = itens.filter((item) => item.tp_secao !== "final");
  const itensFinais = itens.filter((item) => item.tp_secao === "final");
  const temSecoes = itensFinais.length > 0;

  return (
    <Document title={`Orçamento ${numeroProcesso}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.marca}>SOMA</Text>
        <Text style={styles.subMarca}>ASSESSORIA IMOBILIÁRIA</Text>

        <Text style={styles.titulo}>Orçamento de Serviços — Processo {numeroProcesso}</Text>
        <Text style={styles.linhaInfo}>Tipo: {TIPO_PROCESSO_LABEL[tipoProcesso]}</Text>
        <Text style={styles.linhaInfo}>Cidade: {nomeCidade}</Text>
        {nomeComprador && <Text style={styles.linhaInfo}>Cliente: {nomeComprador}</Text>}
        {dsInscricaoMunicipal && (
          <Text style={styles.linhaInfo}>Inscrição Municipal do imóvel: {dsInscricaoMunicipal}</Text>
        )}
        {vlTransacao != null && (
          <Text style={styles.linhaInfo}>Valor da transação: {formatarMoeda(vlTransacao)}</Text>
        )}
        {vlVenal != null && <Text style={styles.linhaInfo}>Valor venal: {formatarMoeda(vlVenal)}</Text>}
        <Text style={styles.linhaInfo}>Válido até: {formatarData(dataValidade)}</Text>

        {temSecoes ? (
          <>
            <Text style={styles.secao}>Custos Iniciais</Text>
            <TabelaItens itens={itensIniciais} />

            <Text style={styles.secao}>Custos Finais</Text>
            <TabelaItens itens={itensFinais} />
          </>
        ) : (
          <>
            <Text style={styles.secao}>Itens do orçamento</Text>
            <TabelaItens itens={itensIniciais} />
          </>
        )}

        <View style={styles.totais}>
          <Text>Honorários: {formatarMoeda(vlTotalHonorarios)}</Text>
          <Text>Custas: {formatarMoeda(vlTotalCustas)}</Text>
          <Text style={styles.totalGeral}>Custo Total: {formatarMoeda(vlTotalGeral)}</Text>
        </View>

        <Text style={{ ...styles.secao, marginTop: 24 }}>Observações</Text>
        <Text style={styles.observacaoTexto}>
          As tabelas de custas de cartórios/TJBA e as alíquotas de tributos municipais (ex.: ITIV)
          estão sujeitas a reajuste periódico pelos respectivos órgãos, sem aviso prévio a esta
          assessoria. Caso o reajuste ocorra entre a emissão deste orçamento e o efetivo pagamento
          dos custos, os valores serão atualizados conforme a tabela vigente na data do pagamento.
        </Text>
        <Text style={styles.observacaoTexto}>
          O Valor Venal utilizado neste orçamento foi informado pelo cliente/imobiliária. Eventual
          divergência apurada pelo fisco municipal na base de cálculo do ITIV é de responsabilidade
          do cliente, podendo gerar cobrança complementar diretamente pela Prefeitura.
        </Text>
        {temSecoes && (
          <Text style={styles.observacaoTexto}>
            Os Custos Iniciais são devidos para dar entrada no processo (lavratura, prenotação e
            demais atos que antecedem o registro). Os Custos Finais são devidos na etapa de
            registro do título, com vencimento em momento distinto dos Custos Iniciais.
          </Text>
        )}

        <Text style={{ ...styles.secao, marginTop: 12 }}>{TERMO_DESPACHANTE_TITULO}</Text>
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
