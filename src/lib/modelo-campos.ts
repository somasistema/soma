// Conferência dos {{campos}} de um modelo de contrato contra o que fn_render_modelo_contrato
// preenche. Campo digitado errado ({{vendedr_1}}) não é trocado na hora de gerar a minuta e
// aparece cru no contrato; bloco aberto e não fechado some com o texto. Aqui isso vira aviso.

const PESSOA = [
  "", "_profissao", "_telefone", "_email", "_conta", "_endereco", "_cpf", "_rg", "_nascimento",
  "_naturalidade", "_nome_pai", "_nome_mae", "_filiacao", "_regime_bens", "_estado_civil", "_pj",
  "_documento_tipo", "_nire", "_tipo_societario", "_vinculo", "_conjuge", "_companheiro", "_anuente",
  "_outro", "_g_brasileiro", "_g_nascido", "_g_portador", "_g_inscrito", "_g_domiciliado", "_g_casado",
  "_g_solteiro",
];
const LADO = ["", "_representantes", "_representantes_nomes", "_anuentes", "_anuentes_nomes", "_representacao", "_conta_titular"];
const CORRETOR = [
  "", "_honorario", "_honorario_extenso", "_percentual", "_cpf", "_creci", "_pix", "_telefone", "_email",
  "_conta", "_nascimento", "_g_brasileiro", "_g_corretor", "_g_inscrito", "_g_domiciliado",
];

const FIXOS = new Set([
  "numero_processo", "data_hoje", "data_extenso", "imobiliaria", "imobiliaria_cnpj", "imobiliaria_creci",
  "imobiliaria_endereco", "pagamento_financiado", "pagamento_a_vista",
  ...[
    "descricao", "endereco", "matricula", "iptu", "cartorio", "cartorio_numero", "cartorio_cidade", "valor",
    "valor_extenso", "forma_pagamento", "sinal", "sinal_extenso", "entrada", "entrada_extenso", "usa_fgts",
    "fgts", "fgts_extenso", "financiamento", "financiamento_extenso", "saldo_quitacao",
    "saldo_quitacao_extenso", "banco", "entrega_chaves", "itens", "ressalva_onus", "prazo_financiamento",
  ].map((s) => "imovel_" + s),
  ...[
    "total", "total_extenso", "percentual", "quando", "imobiliaria", "imobiliaria_extenso",
    "imobiliaria_percentual", "distribuicao",
  ].map((s) => "honorarios_" + s),
  ...[
    "prazo", "prazo_meses", "inicio", "fim", "ano", "chaves", "aluguel", "aluguel_extenso", "condominio",
    "condominio_extenso", "iptu", "iptu_extenso", "aluguel_total", "aluguel_total_extenso", "taxas",
    "dia_vencimento", "primeiro_pagamento", "ultimo_pagamento", "pix", "titular", "agua_texto", "seguro",
    "devolucao_pintura", "tem_caucao", "caucao_valor", "caucao_valor_extenso", "caucao_meses_txt",
    "caucao_base",
  ].map((s) => "locacao_" + s),
]);

const REGEX_PESSOA = new RegExp(`^(vendedor|comprador)_[0-9]+(${PESSOA.join("|")})$`);
const REGEX_LADO = new RegExp(`^(vendedor|comprador)(${LADO.join("|")})$`);
const REGEX_CORRETOR = new RegExp(`^corretor(_[0-9]+(${CORRETOR.join("|")}))?$`);

export function campoConhecido(nome: string): boolean {
  return FIXOS.has(nome) || REGEX_PESSOA.test(nome) || REGEX_LADO.test(nome) || REGEX_CORRETOR.test(nome);
}

export const REGEX_TAG = /\{\{([#^/]?)([A-Za-z0-9_]+)\}\}/g;

export type ProblemaModelo = { tipo: "campo" | "bloco"; texto: string };

// Campos desconhecidos e blocos {{#x}}...{{/x}} que abrem sem fechar (ou fecham sem abrir).
export function analisarModelo(texto: string): ProblemaModelo[] {
  const problemas: ProblemaModelo[] = [];
  const desconhecidos = new Set<string>();
  const pilha: string[] = [];

  for (const m of texto.matchAll(REGEX_TAG)) {
    const [, marca, nome] = m;
    if (!campoConhecido(nome)) desconhecidos.add(nome);
    if (marca === "#" || marca === "^") pilha.push(nome);
    else if (marca === "/") {
      const i = pilha.lastIndexOf(nome);
      if (i < 0) problemas.push({ tipo: "bloco", texto: `{{/${nome}}} fecha um bloco que não foi aberto.` });
      else pilha.splice(i);
    }
  }
  for (const nome of desconhecidos) {
    problemas.push({ tipo: "campo", texto: `{{${nome}}} não é um campo conhecido — confira a grafia.` });
  }
  for (const nome of pilha) {
    problemas.push({ tipo: "bloco", texto: `O bloco {{#${nome}}} (ou {{^${nome}}}) não foi fechado com {{/${nome}}}.` });
  }
  return problemas;
}

// Tipo do modelo pelo nome, só pra etiquetar a lista.
export function tipoDoModelo(nome: string): "Venda" | "Aluguel" | "Vistoria" | "Honorários" | "Outro" {
  const n = nome.toLowerCase();
  if (/vistoria|laudo/.test(n)) return "Vistoria";
  if (/honor[áa]rio|corretagem/.test(n)) return "Honorários";
  if (/loca[çc][ãa]o|aluguel/.test(n)) return "Aluguel";
  if (/compra e venda|promessa|venda/.test(n)) return "Venda";
  return "Outro";
}
