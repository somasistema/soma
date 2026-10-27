import type {
  ArquivoParaAssinar,
  DocumentoCriado,
  ProvedorAssinatura,
  SignatarioEntrada,
} from "./tipos";

// Cliente da API v3 da Clicksign (https://developers.clicksign.com).
//
// Fluxo: cria o envelope -> adiciona o documento -> adiciona os
// signatários -> cria os requisitos (assinar + autenticação por
// e-mail) de cada um -> ativa o envelope -> notifica os signatários.
// Corpo no padrão JSON:API (application/vnd.api+json); o token vai
// cru no header Authorization, sem "Bearer".
//
// O id guardado em contratos.ds_documento_externo_id é
// "<envelope>:<documento>": o webhook só traz a chave do documento, e
// pra baixar o PDF assinado a API pede os dois.

const HOST_PRODUCAO = "https://app.clicksign.com";
const HOST_SANDBOX = "https://sandbox.clicksign.com";

type RespostaJsonApi = {
  data?: { id?: string; links?: { files?: { signed?: string | null } } };
  errors?: { title?: string; detail?: string; code?: string }[];
};

function token(): string {
  const t = process.env.CLICKSIGN_API_TOKEN;
  if (!t) throw new Error("CLICKSIGN_API_TOKEN não configurado.");
  return t;
}

function sandbox(): boolean {
  return process.env.CLICKSIGN_SANDBOX === "true";
}

async function chamar(
  metodo: "GET" | "POST" | "PATCH",
  caminho: string,
  corpo?: unknown
): Promise<RespostaJsonApi> {
  const host = sandbox() ? HOST_SANDBOX : HOST_PRODUCAO;
  const resp = await fetch(`${host}/api/v3${caminho}`, {
    method: metodo,
    headers: {
      Authorization: token(),
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });

  const texto = await resp.text();
  let json: RespostaJsonApi = {};
  try {
    json = texto ? (JSON.parse(texto) as RespostaJsonApi) : {};
  } catch {
    // resposta sem corpo JSON (ex: 204)
  }

  if (!resp.ok) {
    const detalhe =
      json.errors?.map((e) => e.detail ?? e.title ?? e.code).filter(Boolean).join("; ") ||
      `HTTP ${resp.status}`;
    throw new Error(`Clicksign (${metodo} ${caminho}): ${detalhe}`);
  }
  return json;
}

function idDe(resp: RespostaJsonApi, o_que: string): string {
  const id = resp.data?.id;
  if (!id) throw new Error(`Clicksign: resposta sem id de ${o_que}.`);
  return id;
}

// A Clicksign exige ao menos duas palavras no nome do signatário.
function validarNome(nome: string, papel: string): string {
  const limpo = nome.trim().replace(/\s+/g, " ");
  if (limpo.split(" ").length < 2) {
    throw new Error(
      `Clicksign: o nome do signatário "${papel}" precisa ter nome e sobrenome (recebido: "${limpo}").`
    );
  }
  return limpo;
}

function nomeDoArquivo(arquivo: ArquivoParaAssinar): string {
  return arquivo.nome.toLowerCase().endsWith(".pdf") ? arquivo.nome : `${arquivo.nome}.pdf`;
}

export function criarProvedorClicksign(): ProvedorAssinatura {
  return {
    nome: sandbox() ? "clicksign-sandbox" : "clicksign",

    async criarDocumento({
      titulo,
      arquivo,
      signatarios,
    }: {
      titulo: string;
      arquivo: ArquivoParaAssinar;
      signatarios: SignatarioEntrada[];
    }): Promise<DocumentoCriado> {
      // Valida tudo antes de criar qualquer coisa no provedor.
      const nomes = signatarios.map((s) => validarNome(s.nome, s.tp_papel));

      const envelope = await chamar("POST", "/envelopes", {
        data: { type: "envelopes", attributes: { name: titulo } },
      });
      const envelopeId = idDe(envelope, "envelope");

      const documento = await chamar("POST", `/envelopes/${envelopeId}/documents`, {
        data: {
          type: "documents",
          attributes: {
            filename: nomeDoArquivo(arquivo),
            content_base64: `data:${arquivo.tipo || "application/pdf"};base64,${arquivo.conteudo.toString("base64")}`,
          },
        },
      });
      const documentoId = idDe(documento, "documento");

      const criados: DocumentoCriado["signatarios"] = [];

      for (const [i, s] of signatarios.entries()) {
        const temDocumentacao = Boolean(s.cpf && s.nascimento);
        const signer = await chamar("POST", `/envelopes/${envelopeId}/signers`, {
          data: {
            type: "signers",
            attributes: {
              name: nomes[i],
              email: s.email,
              has_documentation: temDocumentacao,
              ...(temDocumentacao ? { documentation: s.cpf, birthday: s.nascimento } : {}),
              communicate_events: {
                signature_request: "email",
                signature_reminder: "email",
                document_signed: "email",
              },
            },
          },
        });
        const signerId = idDe(signer, "signatário");

        const relacionamentos = {
          document: { data: { type: "documents", id: documentoId } },
          signer: { data: { type: "signers", id: signerId } },
        };
        await chamar("POST", `/envelopes/${envelopeId}/requirements`, {
          data: {
            type: "requirements",
            attributes: { action: "agree", role: "sign" },
            relationships: relacionamentos,
          },
        });
        await chamar("POST", `/envelopes/${envelopeId}/requirements`, {
          data: {
            type: "requirements",
            attributes: { action: "provide_evidence", auth: "email" },
            relationships: relacionamentos,
          },
        });

        // O signatário não recebe link na resposta: ele chega por e-mail.
        criados.push({ tp_papel: s.tp_papel, assinaturaExternoId: signerId, urlAssinatura: null });
      }

      await chamar("PATCH", `/envelopes/${envelopeId}`, {
        data: { id: envelopeId, type: "envelopes", attributes: { status: "running" } },
      });

      // Dispara os e-mails de pedido de assinatura.
      await chamar("POST", `/envelopes/${envelopeId}/notifications`, {
        data: { type: "notifications", attributes: {} },
      });

      const host = sandbox() ? HOST_SANDBOX : HOST_PRODUCAO;
      return {
        documentoExternoId: `${envelopeId}:${documentoId}`,
        urlDocumento: `${host}/`,
        signatarios: criados,
      };
    },

    async baixarAssinado(documentoExternoId: string): Promise<Buffer | null> {
      const [envelopeId, documentoId] = documentoExternoId.split(":");
      if (!envelopeId || !documentoId) return null;

      const doc = await chamar("GET", `/envelopes/${envelopeId}/documents/${documentoId}`);
      // O link do arquivo assinado vale só 5 minutos e só existe depois
      // que o documento é finalizado.
      const url = doc.data?.links?.files?.signed;
      if (!url) return null;

      const resp = await fetch(url);
      if (!resp.ok) return null;
      return Buffer.from(await resp.arrayBuffer());
    },
  };
}
