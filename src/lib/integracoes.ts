// Catálogo das integrações externas do SOMA — alimenta o painel em Configurações > Integrações.
// Aqui só ficam nomes de variáveis de ambiente, nunca valores: o painel confere se existem, não as mostra.

export type IntegracaoId =
  | "vercel"
  | "supabase"
  | "anthropic"
  | "resend"
  | "clicksign"
  | "mercadopago"
  | "ocr"
  | "viacep"
  | "brasilapi"
  | "api-cpf"
  | "apibrasil"
  | "infosimples"
  | "onr";

export type Integracao = {
  id: IntegracaoId;
  nome: string;
  categoria: string;
  // em_uso = já faz parte do sistema; planejada = prevista na Fase 3, ainda sem código.
  situacao: "em_uso" | "planejada";
  usoNoSistema: string;
  custo: string;
  // Variáveis que precisam existir para a integração funcionar.
  variaveis: string[];
  // true = o sistema roda sem ela (a função some, mas nada quebra).
  opcional?: boolean;
  // true = há um teste de conexão que não gasta crédito.
  testavel?: boolean;
  site?: string;
};

export const INTEGRACOES: Integracao[] = [
  {
    id: "vercel",
    nome: "Vercel",
    categoria: "Hospedagem",
    situacao: "em_uso",
    usoNoSistema: "Roda o sistema e agenda as funções de servidor (leitura de documentos usa até 60 s).",
    custo: "Conforme o plano contratado",
    variaveis: [],
    site: "https://vercel.com",
  },
  {
    id: "supabase",
    nome: "Supabase",
    categoria: "Banco de dados e arquivos",
    situacao: "em_uso",
    usoNoSistema: "Banco de dados, login, armazenamento dos documentos e tempo real do chat do processo.",
    custo: "Conforme o plano contratado",
    variaveis: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    testavel: true,
    site: "https://supabase.com",
  },
  {
    id: "anthropic",
    nome: "Anthropic (IA Claude)",
    categoria: "Inteligência artificial",
    situacao: "em_uso",
    usoNoSistema:
      "Confere a leitura dos documentos, separa PDF com vários documentos, descreve ambientes da vistoria e sugere mudanças nos modelos de contrato.",
    custo: "Por uso, em dólar: centavos por documento",
    variaveis: ["ANTHROPIC_API_KEY"],
    opcional: true,
    testavel: true,
    site: "https://console.anthropic.com",
  },
  {
    id: "resend",
    nome: "Resend",
    categoria: "E-mail",
    situacao: "em_uso",
    usoNoSistema: "Envia convites de acesso, link do cliente e links de aprovação da minuta.",
    custo: "Grátis até 3.000 e-mails/mês; depois US$ 20/mês",
    variaveis: ["RESEND_API_KEY", "RESEND_FROM_EMAIL"],
    testavel: true,
    site: "https://resend.com",
  },
  {
    id: "clicksign",
    nome: "Clicksign",
    categoria: "Assinatura digital",
    situacao: "em_uso",
    usoNoSistema: "Envia o contrato para assinatura e recebe o aviso de cada assinatura pelo webhook.",
    custo: "Conforme o plano contratado",
    variaveis: ["CLICKSIGN_API_TOKEN", "CLICKSIGN_WEBHOOK_SECRET"],
    testavel: true,
    site: "https://clicksign.com",
  },
  {
    id: "mercadopago",
    nome: "Mercado Pago",
    categoria: "Pagamento",
    situacao: "em_uso",
    usoNoSistema: "Cobra o orçamento por Pix e cartão e recebe a confirmação pelo webhook.",
    custo: "Taxa percentual sobre cada pagamento",
    variaveis: ["MERCADOPAGO_ACCESS_TOKEN", "NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_WEBHOOK_SECRET"],
    testavel: true,
    site: "https://www.mercadopago.com.br/developers",
  },
  {
    id: "ocr",
    nome: "Leitura de documentos (OCR)",
    categoria: "Documentos",
    situacao: "em_uso",
    usoNoSistema: "Tesseract e mupdf rodam dentro do próprio sistema: leem RG, CNH, certidões e comprovantes no upload.",
    custo: "Sem custo externo",
    variaveis: [],
  },
  {
    id: "viacep",
    nome: "ViaCEP",
    categoria: "Consultas (Fase 3)",
    situacao: "em_uso",
    usoNoSistema:
      "Preenche o endereço pelo CEP (parte, imóvel e imobiliária). Se cair, o sistema tenta a BrasilAPI.",
    custo: "Gratuito",
    variaveis: [],
    testavel: true,
    site: "https://viacep.com.br",
  },
  {
    id: "brasilapi",
    nome: "BrasilAPI (CNPJ)",
    categoria: "Consultas (Fase 3)",
    situacao: "em_uso",
    usoNoSistema:
      "Traz razão social, situação cadastral, endereço, telefone e e-mail pelo CNPJ (empresa na parte e imobiliária). Reserva: Minha Receita.",
    custo: "Gratuito",
    variaveis: [],
    testavel: true,
    site: "https://brasilapi.com.br",
  },
  {
    id: "api-cpf",
    nome: "API CPF",
    categoria: "Consultas (Fase 3)",
    situacao: "planejada",
    usoNoSistema: "Consultar a situação cadastral do CPF das partes.",
    custo: "Plano grátis para testar; Plus R$ 29,90/mês",
    variaveis: ["API_CPF_TOKEN"],
  },
  {
    id: "apibrasil",
    nome: "APIBrasil",
    categoria: "Consultas (Fase 3)",
    situacao: "planejada",
    usoNoSistema: "Certidão Negativa PF (R$ 1,80), Débitos PJ (R$ 0,72) e Protesto Nacional (R$ 20,85, só sob demanda).",
    custo: "Por consulta, com saldo pré-pago",
    variaveis: ["APIBRASIL_TOKEN"],
    site: "https://apibrasil.io",
  },
  {
    id: "infosimples",
    nome: "Infosimples",
    categoria: "Consultas (Fase 3)",
    situacao: "planejada",
    usoNoSistema: "Certidão Negativa de Débitos (R$ 0,20) e Nada Consta (R$ 0,24) da Prefeitura de Salvador.",
    custo: "Por consulta",
    variaveis: ["INFOSIMPLES_TOKEN"],
    site: "https://infosimples.com",
  },
  {
    id: "onr",
    nome: "ONR / cartórios",
    categoria: "Consultas (Fase 3)",
    situacao: "planejada",
    usoNoSistema: "Matrícula e certidões de imóvel. Depende de contrato; por enquanto fica como contingência manual.",
    custo: "Conforme contrato",
    variaveis: [],
  },
];

export type EstadoIntegracao = {
  // configurada = todas as variáveis necessárias existem (ou não precisa de nenhuma).
  configurada: boolean;
  faltando: string[];
  // Frases curtas sobre o que foi detectado ou sobre o risco, sem nunca mostrar valor de segredo.
  avisos: string[];
};

function tem(nome: string): boolean {
  return Boolean(process.env[nome]?.trim());
}

// Só lê o ambiente do servidor: chame em Server Component ou Server Action.
export function estadoDaIntegracao(i: Integracao): EstadoIntegracao {
  const avisos: string[] = [];
  let faltando = i.variaveis.filter((v) => !tem(v));

  // RESEND_FROM_EMAIL é o único que não impede de enviar: sem ele o e-mail sai de uma conta de teste.
  if (i.id === "resend" && faltando.includes("RESEND_FROM_EMAIL")) {
    faltando = faltando.filter((v) => v !== "RESEND_FROM_EMAIL");
    avisos.push(
      "Sem RESEND_FROM_EMAIL o e-mail sai da conta de teste do Resend e só chega ao e-mail do dono da conta. Configure um domínio verificado."
    );
  }
  if (i.id === "clicksign" && tem("CLICKSIGN_API_TOKEN")) {
    avisos.push(
      process.env.CLICKSIGN_SANDBOX === "true"
        ? "Modo sandbox: as assinaturas NÃO têm validade jurídica. Em produção, deixe CLICKSIGN_SANDBOX vazio."
        : "Modo produção."
    );
  }
  if (i.id === "mercadopago" && tem("MERCADOPAGO_ACCESS_TOKEN")) {
    avisos.push(
      process.env.MERCADOPAGO_ACCESS_TOKEN!.startsWith("TEST-")
        ? "Credenciais de teste: nenhum pagamento é real."
        : "Credenciais de produção."
    );
  }
  if (i.id === "vercel") {
    const amb = process.env.VERCEL_ENV;
    avisos.push(amb ? `Ambiente atual: ${amb}.` : "Rodando fora da Vercel (ambiente local).");
  }
  if (i.id === "anthropic" && faltando.length > 0) {
    avisos.push(
      "Sem a chave, a leitura por IA fica desligada: o PDF com vários documentos não funciona e as sugestões de modelo não aparecem."
    );
  }
  if (i.situacao === "planejada" && i.variaveis.length > 0 && faltando.length > 0) {
    avisos.push("Ainda não implementada no código; a variável será usada quando a Fase 3 chegar a este item.");
  }

  return { configurada: faltando.length === 0, faltando, avisos };
}
