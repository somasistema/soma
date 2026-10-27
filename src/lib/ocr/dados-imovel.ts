import Anthropic from "@anthropic-ai/sdk";
import type { createServiceRoleClient } from "@/lib/supabase/server";
import { CARTORIOS_IMOVEIS } from "@/types/database";

// Dados do imóvel lidos da certidão de ônus / IPTU pra preencher o
// processo sozinho. Mesmo esquema de validar-ia.ts: Haiku 4.5 com
// tool_choice forçado, opcional (sem ANTHROPIC_API_KEY não roda), e só
// completa campo vazio — nunca sobrescreve o que alguém digitou.
const MODELO = "claude-haiku-4-5";
// Matrícula escaneada: letra miúda e a descrição vai literal pro contrato
// (medidas), então a leitura da imagem usa o modelo maior. Ele não aceita
// tool_choice forçado; com uma ferramenta só e a instrução, chama sozinho.
const MODELO_IMAGEM = "claude-sonnet-5-5";

export type DadosImovelLidos = {
  endereco: string | null;
  matricula: string | null;
  inscricaoMunicipal: string | null;
  cartorioCodigo: string | null;
  // Parágrafo "IMÓVEL:" da matrícula (unidade, vaga, áreas, fração ideal)
  descricao: string | null;
};

const FERRAMENTA = {
  name: "reportar_dados_imovel",
  description:
    "Reporta os dados de identificação do imóvel encontrados no documento. Campo que não aparece no documento vai como null — nunca invente nem use marcadores.",
  input_schema: {
    type: "object" as const,
    properties: {
      endereco: {
        type: ["string", "null"],
        description:
          "Endereço completo do imóvel (rua, número, complemento, bairro, cidade/UF), só de IPTU/cadastro municipal. Na matrícula use null (o endereço fica na descrição). Null se não aparecer.",
      },
      matricula: {
        type: ["string", "null"],
        description: "Número da matrícula do imóvel no registro de imóveis, como aparece (ex: '11.148').",
      },
      inscricao_municipal: {
        type: ["string", "null"],
        description: "Inscrição imobiliária/municipal do IPTU, como aparece.",
      },
      cartorio_numero: {
        type: ["integer", "null"],
        description: "Número do ofício/cartório de registro de imóveis (ex: 3 para '3º Ofício').",
      },
      cartorio_cidade: {
        type: ["string", "null"],
        description: "Cidade do cartório de registro de imóveis (ex: 'Salvador').",
      },
      descricao: {
        type: ["string", "null"],
        description:
          "SOMENTE na matrícula/certidão de matrícula: a descrição do imóvel copiada do campo 'IMÓVEL:', do início ('APARTAMENTO de nº…', 'CASA…', 'LOTE…') até a fração ideal inclusive (ex: '…correspondendo à fração ideal de 0,13580% ou 43,660m²'), parando aí: não inclua 'Dito empreendimento…', terreno, confrontações, sem o rótulo 'IMÓVEL:', sem cadastro municipal, proprietário, título ou registros. Copie fiel, caractere por caractere, sem corrigir nem resumir; confira cada número de medida duas vezes. Null se o documento não for matrícula.",
      },
    },
    required: ["endereco", "matricula", "inscricao_municipal", "cartorio_numero", "cartorio_cidade", "descricao"],
  },
};

// A IA às vezes devolve um marcador ("<UNKNOWN>", "N/A") em vez de null.
function limpar(valor: string | null | undefined): string | null {
  const v = valor?.trim();
  if (!v) return null;
  if (/[<>]/.test(v) || /^(n\/?a|null|none|unknown|desconhecid[oa]|não (consta|informad[oa]))$/i.test(v)) {
    return null;
  }
  return v;
}

function semAcento(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

// Só aceita cartório da lista atendida (Salvador 1º–7º, Lauro de
// Freitas 1º, Camaçari 1º–2º); o resto fica pra escolher à mão.
function codigoCartorio(numero: number | null, cidade: string | null): string | null {
  if (!numero || !cidade) return null;
  const slug = semAcento(cidade).replace(/\s+/g, "-");
  const codigo = `${slug}-${numero}`;
  return CARTORIOS_IMOVEIS.some((c) => c.codigo === codigo) ? codigo : null;
}

export async function lerDadosImovelComIA(params: {
  texto: string;
  imagem: { dados: Buffer; mimeType: string } | null;
}): Promise<DadosImovelLidos | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const mediaType = params.imagem?.mimeType.includes("png")
    ? "image/png"
    : params.imagem?.mimeType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

  // Matrícula escaneada tem só a capa em texto nativo: com imagem, manda
  // a imagem junto do texto pra IA ler o corpo da matrícula.
  const conteudo: Anthropic.ContentBlockParam[] = [
    ...(params.imagem
      ? [
          {
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: mediaType as "image/png" | "image/webp" | "image/jpeg",
              data: params.imagem.dados.toString("base64"),
            },
          },
        ]
      : []),
    {
      type: "text",
      text:
        "Documento brasileiro de imóvel (certidão de ônus/matrícula ou carnê/certidão de IPTU). " +
        "Extraia os dados de identificação do imóvel chamando a ferramenta reportar_dados_imovel." +
        (params.texto.trim()
          ? "\n\nTexto extraído do documento:\n" + params.texto.slice(0, 14000)
          : ""),
    },
  ];

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: params.imagem ? MODELO_IMAGEM : MODELO,
      max_tokens: 1024,
      tools: [FERRAMENTA],
      tool_choice: params.imagem ? { type: "auto" } : { type: "tool", name: "reportar_dados_imovel" },
      messages: [{ role: "user", content: conteudo }],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const input = toolUse.input as {
      endereco: string | null;
      matricula: string | null;
      inscricao_municipal: string | null;
      cartorio_numero: number | null;
      cartorio_cidade: string | null;
      descricao: string | null;
    };

    return {
      endereco: limpar(input.endereco),
      matricula: limpar(input.matricula),
      inscricaoMunicipal: limpar(input.inscricao_municipal),
      cartorioCodigo: codigoCartorio(input.cartorio_numero, limpar(input.cartorio_cidade)),
      descricao: limpar(input.descricao)?.replace(/^im[óo]vel:\s*/i, "").replace(/\s+/g, " ").replace(/[\s.,;]+$/, "") ?? null,
    };
  } catch (erro) {
    console.error("[ocr] falha na leitura dos dados do imóvel:", erro);
    return null;
  }
}

// Completa processo_negocio só onde está vazio.
export async function aplicarDadosImovel(
  supabase: ReturnType<typeof createServiceRoleClient>,
  cdProcesso: string,
  dados: DadosImovelLidos
) {
  const { data: atual } = await supabase
    .schema("soma")
    .from("processo_negocio")
    .select("ds_imovel_endereco, ds_imovel_matricula, ds_imovel_iptu, ds_imovel_cartorio, ds_imovel_descricao")
    .eq("cd_processo", cdProcesso)
    .maybeSingle();

  const patch: Record<string, string> = {};
  if (!atual?.ds_imovel_endereco && dados.endereco) patch.ds_imovel_endereco = dados.endereco;
  if (!atual?.ds_imovel_matricula && dados.matricula) patch.ds_imovel_matricula = dados.matricula;
  if (!atual?.ds_imovel_iptu && dados.inscricaoMunicipal) patch.ds_imovel_iptu = dados.inscricaoMunicipal;
  if (!atual?.ds_imovel_cartorio && dados.cartorioCodigo) patch.ds_imovel_cartorio = dados.cartorioCodigo;
  if (!atual?.ds_imovel_descricao && dados.descricao) patch.ds_imovel_descricao = dados.descricao;

  if (Object.keys(patch).length === 0) return;

  if (atual) {
    await supabase.schema("soma").from("processo_negocio").update(patch).eq("cd_processo", cdProcesso);
  } else {
    await supabase.schema("soma").from("processo_negocio").insert({ cd_processo: cdProcesso, ...patch });
  }
}
