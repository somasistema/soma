import type {
  ArquivoParaAssinar,
  DocumentoCriado,
  ProvedorAssinatura,
  SignatarioEntrada,
} from "./tipos";

// Cliente da API GraphQL v2 da Autentique (https://docs.autentique.com.br).
// Upload de arquivo segue o graphql-multipart-request-spec.
//
// OBS: a integração ainda não roda de verdade (sem conta/token). A
// forma das queries segue a doc pública; confirmar os nomes exatos de
// campos/enums quando a conta existir e AUTENTIQUE_API_TOKEN estiver
// configurado.

const ENDPOINT = "https://api.autentique.com.br/v2/graphql";

const CREATE_DOCUMENT = `
mutation CriarDocumento($sandbox: Boolean!, $document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
  createDocument(sandbox: $sandbox, document: $document, signers: $signers, file: $file) {
    id
    signatures {
      public_id
      email
      action { name }
      link { short_link }
    }
  }
}`;

const DOCUMENT_FILES = `
query Documento($id: UUID!) {
  document(id: $id) {
    files { signed }
  }
}`;

type SignatureNode = {
  public_id: string | null;
  email: string | null;
  link: { short_link: string | null } | null;
};

function token(): string {
  const t = process.env.AUTENTIQUE_API_TOKEN;
  if (!t) throw new Error("AUTENTIQUE_API_TOKEN não configurado.");
  return t;
}

async function graphql<T>(body: FormData | string): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token()}` };
  if (typeof body === "string") headers["Content-Type"] = "application/json";

  const resp = await fetch(ENDPOINT, { method: "POST", headers, body });
  const json = (await resp.json()) as { data?: T; errors?: { message: string }[] };

  if (!resp.ok || json.errors?.length) {
    const msg = json.errors?.map((e) => e.message).join("; ") || `HTTP ${resp.status}`;
    throw new Error(`Autentique: ${msg}`);
  }
  if (!json.data) throw new Error("Autentique: resposta sem dados.");
  return json.data;
}

export function criarProvedorAutentique(): ProvedorAssinatura {
  const sandbox = process.env.AUTENTIQUE_SANDBOX === "true";

  return {
    nome: sandbox ? "autentique-sandbox" : "autentique",

    async criarDocumento({
      titulo,
      arquivo,
      signatarios,
    }: {
      titulo: string;
      arquivo: ArquivoParaAssinar;
      signatarios: SignatarioEntrada[];
    }): Promise<DocumentoCriado> {
      const variables = {
        sandbox,
        document: { name: titulo },
        signers: signatarios.map((s) => ({
          email: s.email,
          name: s.nome,
          action: "SIGN",
        })),
        file: null,
      };

      const form = new FormData();
      form.append(
        "operations",
        JSON.stringify({ query: CREATE_DOCUMENT, variables })
      );
      form.append("map", JSON.stringify({ "0": ["variables.file"] }));
      form.append(
        "0",
        new Blob([new Uint8Array(arquivo.conteudo)], { type: arquivo.tipo }),
        arquivo.nome
      );

      const data = await graphql<{
        createDocument: { id: string; signatures: SignatureNode[] };
      }>(form);

      const doc = data.createDocument;
      const porEmail = new Map(
        doc.signatures.map((sig) => [(sig.email ?? "").toLowerCase(), sig])
      );

      return {
        documentoExternoId: doc.id,
        urlDocumento: `https://painel.autentique.com.br/documentos/${doc.id}`,
        signatarios: signatarios.map((s) => {
          const sig = porEmail.get(s.email.toLowerCase());
          return {
            tp_papel: s.tp_papel,
            assinaturaExternoId: sig?.public_id ?? null,
            urlAssinatura: sig?.link?.short_link ?? null,
          };
        }),
      };
    },

    async baixarAssinado(documentoExternoId: string): Promise<Buffer | null> {
      const data = await graphql<{ document: { files: { signed: string | null } } }>(
        JSON.stringify({ query: DOCUMENT_FILES, variables: { id: documentoExternoId } })
      );
      const url = data.document?.files?.signed;
      if (!url) return null;

      const resp = await fetch(url);
      if (!resp.ok) return null;
      return Buffer.from(await resp.arrayBuffer());
    },
  };
}
