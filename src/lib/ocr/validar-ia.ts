import Anthropic from "@anthropic-ai/sdk";
import type { CampoLido } from "./parsers";

// Conferência do resultado do OCR local (Tesseract) por IA — não
// substitui o Tesseract, só confere: manda a imagem do documento +
// o que foi lido, e a IA aponta o que bate e o que não bate. Rodando
// só quando ANTHROPIC_API_KEY existe; sem ela essa etapa é pulada e
// o OCR local continua funcionando normalmente.
//
// Modelo: Haiku 4.5 — tarefa de conferência simples e de alto volume,
// não precisa do modelo mais caro (ver memória do projeto: decisão
// registrada de custo, ~R$0,005 por documento).
const MODELO = "claude-haiku-4-5";

export type ResultadoValidacaoIA = {
  tipoConfere: boolean;
  tipoSugerido: string | null;
  campos: {
    nm_campo: string;
    confere: boolean;
    valorSugerido: string | null;
    confianca: number;
  }[];
};

const FERRAMENTA = {
  name: "reportar_conferencia",
  description: "Reporta o resultado da conferência do documento contra a leitura automática (OCR).",
  input_schema: {
    type: "object" as const,
    properties: {
      tipo_confere: {
        type: "boolean",
        description: "Se o tipo de documento informado bate com o que a imagem mostra.",
      },
      tipo_sugerido: {
        type: ["string", "null"],
        description: "Se tipo_confere for false, o tipo correto (ex: 'rg', 'cpf', 'comprovante_residencia').",
      },
      campos: {
        type: "array",
        description: "Um item para cada campo lido pelo OCR, na mesma ordem recebida.",
        items: {
          type: "object",
          properties: {
            nm_campo: { type: "string" },
            confere: { type: "boolean", description: "Se o valor lido bate com o que está na imagem." },
            valor_sugerido: {
              type: ["string", "null"],
              description: "Se confere for false, o valor correto lido na imagem.",
            },
            confianca: {
              type: "number",
              description: "Confiança na própria conferência, de 0 a 100 (nunca uma fração de 0 a 1).",
            },
          },
          required: ["nm_campo", "confere", "valor_sugerido", "confianca"],
        },
      },
    },
    required: ["tipo_confere", "tipo_sugerido", "campos"],
  },
};

export async function validarOcrComIA(params: {
  imagem: Buffer;
  mimeType: string;
  tipoDetectado: string;
  campos: CampoLido[];
}): Promise<ResultadoValidacaoIA | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (params.campos.length === 0) return null;

  const client = new Anthropic();

  const mediaType = params.mimeType.includes("png")
    ? "image/png"
    : params.mimeType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

  try {
    const response = await client.messages.create({
      model: MODELO,
      max_tokens: 1024,
      tools: [FERRAMENTA],
      tool_choice: { type: "tool", name: "reportar_conferencia" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: params.imagem.toString("base64") },
            },
            {
              type: "text",
              text:
                `Este é um documento brasileiro. Um sistema de OCR detectou o tipo "${params.tipoDetectado}" ` +
                `e leu os seguintes campos:\n\n${JSON.stringify(
                  params.campos.map((c) => ({ nm_campo: c.nm_campo, ds_valor: c.ds_valor }))
                )}\n\n` +
                `Confira cada campo contra a imagem do documento e diga se o valor lido está correto.`,
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const input = toolUse.input as {
      tipo_confere: boolean;
      tipo_sugerido: string | null;
      campos: { nm_campo: string; confere: boolean; valor_sugerido: string | null; confianca: number }[];
    };

    return {
      tipoConfere: input.tipo_confere,
      tipoSugerido: input.tipo_sugerido,
      campos: input.campos.map((c) => ({
        nm_campo: c.nm_campo,
        confere: c.confere,
        valorSugerido: c.valor_sugerido,
        confianca: c.confianca,
      })),
    };
  } catch (erro) {
    console.error("[ocr] falha na conferência por IA:", erro);
    return null;
  }
}

// Leitura de resgate: quando o Tesseract não achou NENHUM campo (ex:
// documento com fundo colorido/textura forte demais — certidão,
// documento plastificado etc.), a IA lê a imagem do zero e extrai o
// que der, no lugar de deixar o documento sem nenhum dado. Campos sem
// nome padronizado (ver CAMPO_OCR_LABEL) aparecem na tela com o nome
// cru que a IA deu — ainda dá pra conferir/editar normalmente.
export type ResultadoLeituraIA = {
  tipoDetectado: string | null;
  campos: { nm_campo: string; ds_valor: string; confianca: number }[];
};

const FERRAMENTA_LEITURA = {
  name: "reportar_leitura",
  description: "Reporta o tipo do documento e os campos lidos na imagem.",
  input_schema: {
    type: "object" as const,
    properties: {
      tipo_detectado: {
        type: ["string", "null"],
        description:
          "Tipo do documento em snake_case (ex: 'rg', 'cpf', 'certidao_casamento', 'certidao_nascimento', 'comprovante_residencia', 'matricula_imovel'). Null se não der pra identificar.",
      },
      campos: {
        type: "array",
        description: "Cada dado relevante que aparece no documento (nome, CPF, datas, números de registro...).",
        items: {
          type: "object",
          properties: {
            nm_campo: {
              type: "string",
              description: "Nome curto em snake_case e português (ex: 'nome_conjuge_1', 'data_casamento').",
            },
            ds_valor: { type: "string" },
            confianca: { type: "number", description: "0 a 100 (nunca fração de 0 a 1)." },
          },
          required: ["nm_campo", "ds_valor", "confianca"],
        },
      },
    },
    required: ["tipo_detectado", "campos"],
  },
};

export async function lerDocumentoComIA(params: {
  imagem: Buffer;
  mimeType: string;
}): Promise<ResultadoLeituraIA | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const client = new Anthropic();

  const mediaType = params.mimeType.includes("png")
    ? "image/png"
    : params.mimeType.includes("webp")
      ? "image/webp"
      : "image/jpeg";

  try {
    const response = await client.messages.create({
      model: MODELO,
      max_tokens: 1536,
      tools: [FERRAMENTA_LEITURA],
      tool_choice: { type: "tool", name: "reportar_leitura" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: params.imagem.toString("base64") },
            },
            {
              type: "text",
              text:
                "Este é um documento brasileiro. A leitura automática (OCR) não conseguiu extrair nenhum " +
                "campo dele (provavelmente por causa do fundo com padrão de segurança/textura). Leia a " +
                "imagem e extraia o tipo do documento e os dados relevantes.",
            },
          ],
        },
      ],
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") return null;

    const input = toolUse.input as {
      tipo_detectado: string | null;
      campos: { nm_campo: string; ds_valor: string; confianca: number }[];
    };

    return { tipoDetectado: input.tipo_detectado, campos: input.campos ?? [] };
  } catch (erro) {
    console.error("[ocr] falha na leitura de resgate por IA:", erro);
    return null;
  }
}
