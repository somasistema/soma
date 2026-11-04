// Assistente de IA do editor de modelos. Dois usos:
//  - "campos": o texto é um contrato PREENCHIDO de um caso real (ex.: importado de um Word); a IA
//    acha os dados específicos do caso (nomes, CPF, valores, datas, matrícula...) e propõe trocar
//    cada um pelo {{campo}} do sistema;
//  - "instrucao": a pessoa pede uma mudança em linguagem natural ("passe o prazo pra 90 dias",
//    "acrescente uma cláusula de multa") e a IA propõe as alterações no texto.
//
// A IA NÃO reescreve o texto: devolve uma lista de trocas pontuais (trecho exato -> novo trecho). A
// tela mostra cada uma, a pessoa marca as que aceita e só então elas são aplicadas. Trecho que não
// existe no texto ou que traz campo inexistente é descartado aqui, antes de chegar à tela.
import { campoConhecido, REGEX_TAG } from "@/lib/modelo-campos";
import { CAMPOS_MODELO_CONTRATO } from "@/types/database";

import type { EdicaoModelo, SugestoesModelo } from "@/lib/modelo-edicoes";
export type { EdicaoModelo, SugestoesModelo };

// O modelo maior acha muito mais dados que o rápido (testado: 48 trocas contra 18 no mesmo contrato).
const MODELO = "claude-sonnet-5-5";
// Contrato inteiro numa chamada passa de 60 s (limite da ação). É dividido em partes de ~2,6 mil
// caracteres, analisadas ao mesmo tempo, cada uma cuidando só dos dados do seu trecho (o texto todo
// vai junto como contexto). Medido num contrato real de 22 mil caracteres: 29 a 34 s, 48 a 55 trocas.
// Sem o raciocínio do modelo achava só ~26 trocas; com partes grandes, o tempo chegou a 58 s.
const TAMANHO_PARTE = 2600;
const MAX_PARTES = 12;
const LIMITE_TEXTO = 45000;

const FERRAMENTA = {
  name: "propor_edicoes",
  description: "Propõe trocas pontuais no texto do modelo de contrato.",
  input_schema: {
    type: "object" as const,
    properties: {
      edicoes: {
        type: "array",
        description: "No máximo 80 trocas, na ordem em que aparecem no texto.",
        items: {
          type: "object",
          properties: {
            tipo: {
              type: "string",
              enum: ["substituir", "inserir_apos", "remover"],
              description:
                "substituir: troca 'trecho' por 'novo'. inserir_apos: acrescenta 'novo' logo depois de 'trecho' (que não muda). remover: apaga 'trecho'.",
            },
            trecho: {
              type: "string",
              description:
                "Trecho do texto, copiado EXATAMENTE como está (acentos, caixa, pontuação, espaços), o menor que identifica o dado. Tem que existir no texto.",
            },
            novo: { type: "string", description: "Texto novo (vazio em 'remover'). Campos entram como {{nome_do_campo}}." },
            todas: {
              type: "boolean",
              description: "true quando o mesmo trecho aparece várias vezes e todas devem ser trocadas.",
            },
            motivo: { type: "string", description: "Uma frase curta explicando a troca, ex.: 'Nome do 1º vendedor'." },
          },
          required: ["tipo", "trecho", "novo", "todas", "motivo"],
        },
      },
      avisos: {
        type: "array",
        items: { type: "string" },
        description:
          "Observações pra pessoa, curtas: o que não foi possível trocar (dado sem campo, trecho que mereceria bloco condicional...).",
      },
    },
    required: ["edicoes", "avisos"],
  },
};

function catalogo(): string {
  return CAMPOS_MODELO_CONTRATO.map(
    (g) => `## ${g.grupo}\n` + g.campos.map((c) => `${c.token} — ${c.descricao}`).join("\n")
  ).join("\n\n");
}

const EXPLICACAO_CAMPOS = `COMO OS CAMPOS FUNCIONAM
- {{campo}} é trocado pelo dado do processo na hora de gerar a minuta; o que não existir vira ________.
- vendedor/comprador numerados: {{vendedor_1}} é o 1º vendedor, {{vendedor_2}} o 2º (cônjuge, companheiro...); na locação o locador usa vendedor_N e o locatário comprador_N. O mesmo vale para corretor_N.
- Cada pessoa tem: _cpf, _rg, _nascimento, _profissao, _endereco, _naturalidade, _filiacao, _regime_bens, _estado_civil, _conta e os de gênero (_g_brasileiro = brasileiro/brasileira, _g_nascido, _g_portador, _g_inscrito, _g_domiciliado, _g_casado, _g_solteiro). Na qualificação de pessoa física, em vez da palavra fixa (brasileiro, nascido, portador, inscrito) use o campo de gênero da pessoa certa.
- Valores têm o campo numérico (R$) e o "_extenso" (por extenso): são DUAS trocas, uma para o número e outra para o extenso.
- Blocos condicionais ({{#campo}}...{{/campo}}) só entram se o campo tiver valor; você NÃO cria blocos novos aqui — se um trecho deveria ser condicional (ex.: parte do 2º vendedor), deixe-o como está e avise.`;

function promptCampos(texto: string, foco?: string): string {
  return `Você prepara modelos de contrato imobiliário (Salvador/BA) para um sistema que gera a minuta de cada processo com os dados dele.

O texto abaixo é um contrato JÁ PREENCHIDO de um caso real. Transforme-o em modelo: ache cada dado específico DESTE caso (nomes, CPF/CNPJ, RG, datas de nascimento, naturalidade, filiação, profissão, endereços, matrícula, inscrição do IPTU, cartório, valores em R$ e por extenso, banco/agência/conta, prazos e datas do caso, data da assinatura, nomes de corretores/imobiliária) e proponha trocá-lo pelo campo certo da lista.

${EXPLICACAO_CAMPOS}

REGRAS
- Copie "trecho" EXATAMENTE como está no texto. Prefira o menor trecho que identifica o dado (só o nome, só o número).
- Mesmo dado em vários lugares: uma edição com todas=true.
- NÃO troque texto jurídico, cláusulas, percentuais e prazos que são regra do modelo (ex.: multa de 10%, "30 dias" de aviso), nem palavras que valem para qualquer caso.
- Data da assinatura (ex.: "07 de julho de 2026" depois de "Salvador/BA,") vira {{data_extenso}}.
- Só use campos da lista. Dado sem campo correspondente: não troque e cite em "avisos" (curtos).
- Seja completo: aqui vale mais achar todos os dados do caso do que ser tímido, mas nunca troque algo de que não tenha certeza.

CAMPOS DISPONÍVEIS
${catalogo()}

${
  foco
    ? `TRECHO EM FOCO — proponha trocas SOMENTE para dados que aparecem neste trecho (o texto completo abaixo é só contexto: serve pra saber quem é o 1º e o 2º vendedor, o comprador etc.; outra pessoa cuida do resto):
"""
${foco}
"""

`
    : ""
}TEXTO COMPLETO DO CONTRATO
"""
${texto}
"""

Chame a ferramenta propor_edicoes.`;
}

function promptInstrucao(texto: string, instrucao: string): string {
  return `Você ajuda a editar um modelo de contrato imobiliário (Salvador/BA) usado por um sistema que gera a minuta de cada processo.

${EXPLICACAO_CAMPOS}

PEDIDO DA PESSOA
"""
${instrucao}
"""

REGRAS
- Proponha o MÍNIMO de trocas pontuais necessárias para atender ao pedido; não reescreva o que não foi pedido.
- Copie "trecho" EXATAMENTE como está no texto (precisa existir lá). Para acrescentar uma cláusula ou parágrafo novo, use tipo inserir_apos com o trecho (um pedaço do parágrafo anterior) e escreva "novo" começando por uma linha em branco (duas quebras de linha) antes do novo parágrafo.
- Use campos da lista abaixo quando o texto novo precisar de dados do processo; nunca invente campo.
- Mantenha o estilo jurídico e a numeração (CLÁUSULA…, 4.1…) do texto; se uma inserção desalinhar a numeração, avise.

CAMPOS DISPONÍVEIS
${catalogo()}

TEXTO ATUAL DO MODELO
"""
${texto}
"""

Chame a ferramenta propor_edicoes.`;
}

function ocorrencias(texto: string, trecho: string): number {
  if (!trecho) return 0;
  return texto.split(trecho).length - 1;
}

// Filtra o que a IA devolveu: o trecho tem que existir, o campo novo tem que existir.
export function validarEdicoes(texto: string, brutas: unknown, avisosIA: unknown): SugestoesModelo {
  const avisos = [...new Set((Array.isArray(avisosIA) ? avisosIA : []).map((a) => String(a).trim()).filter(Boolean))];
  const edicoes: EdicaoModelo[] = [];
  let descartadas = 0;
  const vistos = new Set<string>();

  for (const e of Array.isArray(brutas) ? brutas : []) {
    const tipo = e?.tipo;
    const trecho = typeof e?.trecho === "string" ? e.trecho : "";
    const novo = typeof e?.novo === "string" ? e.novo : "";
    if (!["substituir", "inserir_apos", "remover"].includes(tipo) || !trecho) {
      descartadas++;
      continue;
    }
    const n = ocorrencias(texto, trecho);
    const chave = `${tipo}|${trecho}|${novo}`;
    if (n === 0 || vistos.has(chave) || (tipo !== "remover" && !novo)) {
      if (!vistos.has(chave)) descartadas++;
      continue;
    }
    // campo inventado: descarta
    const inventado = [...novo.matchAll(REGEX_TAG)].some((m) => !campoConhecido(m[2]));
    if (inventado) {
      descartadas++;
      continue;
    }
    vistos.add(chave);
    edicoes.push({
      tipo,
      trecho,
      novo: tipo === "remover" ? "" : novo,
      todas: Boolean(e?.todas),
      motivo: typeof e?.motivo === "string" ? e.motivo.trim() : "",
      ocorrencias: n,
    });
  }
  if (descartadas > 0) {
    avisos.push(`${descartadas} sugestão(ões) foram descartadas por não bater com o texto ou usar campo que não existe.`);
  }
  return { edicoes, avisos };
}

async function chamarIA(prompt: string): Promise<{ edicoes?: unknown; avisos?: unknown } | null> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  // O modelo maior pensa antes de responder (por isso não aceita ferramenta forçada: o prompt manda
  // chamá-la) e esse raciocínio usa max_tokens: folga, senão a resposta é cortada.
  const resposta = await client.messages.create({
    model: MODELO,
    max_tokens: 16000,
    tools: [FERRAMENTA],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: prompt }],
  });
  const uso = resposta.content.find((b) => b.type === "tool_use");
  return uso && uso.type === "tool_use" ? (uso.input as { edicoes?: unknown; avisos?: unknown }) : null;
}

// Divide em blocos de parágrafos de tamanho parecido, sem cortar parágrafo.
export function dividirEmPartes(texto: string): string[] {
  const paragrafos = texto.split(/\n{2,}/);
  const alvo = Math.max(TAMANHO_PARTE, Math.ceil(texto.length / MAX_PARTES));
  const partes: string[] = [];
  let atual = "";
  for (const p of paragrafos) {
    if (atual && atual.length + p.length > alvo) {
      partes.push(atual);
      atual = "";
    }
    atual += (atual ? "\n\n" : "") + p;
  }
  if (atual) partes.push(atual);
  return partes;
}

async function analisarPartes(
  texto: string
): Promise<{ validas: number; falhou: boolean; brutas: unknown[]; avisos: unknown[] }> {
  const partes = dividirEmPartes(texto);
  const respostas = await Promise.all(
    partes.map((p) =>
      chamarIA(promptCampos(texto, partes.length > 1 ? p : undefined)).catch((e) => {
        console.error("[modelo-ia] parte falhou:", e instanceof Error ? e.message : e);
        return null;
      })
    )
  );
  const validas = respostas.filter((r): r is NonNullable<typeof r> => r !== null);
  return {
    validas: validas.length,
    falhou: validas.length < respostas.length,
    brutas: validas.flatMap((r) => (Array.isArray(r.edicoes) ? r.edicoes : [])),
    avisos: validas.flatMap((r) => (Array.isArray(r.avisos) ? r.avisos : [])),
  };
}

export async function sugerirEdicoesModelo(params: {
  texto: string;
  modo: "campos" | "instrucao";
  instrucao?: string;
}): Promise<SugestoesModelo | { erro: string }> {
  if (!process.env.ANTHROPIC_API_KEY) return { erro: "A IA não está configurada (ANTHROPIC_API_KEY)." };
  const texto = params.texto.trim();
  if (texto.length < 40) return { erro: "O modelo está muito curto para a IA analisar." };
  if (texto.length > LIMITE_TEXTO) return { erro: "O modelo é grande demais para a IA (limite de 45 mil caracteres)." };
  if (params.modo === "instrucao" && !params.instrucao?.trim()) return { erro: "Escreva o que você quer mudar." };

  try {
    if (params.modo === "instrucao") {
      const entrada = await chamarIA(promptInstrucao(texto, params.instrucao!.trim()));
      if (!entrada) return { erro: "A IA não devolveu sugestões desta vez. Tente de novo." };
      return validarEdicoes(texto, entrada.edicoes, entrada.avisos);
    }

    // O contrato todo, em partes, ao mesmo tempo. A mesma troca vinda de duas partes entra uma vez; a
    // lista segue a ordem em que os dados aparecem no texto.
    const r = await analisarPartes(texto);
    if (r.validas === 0) return { erro: "A IA não devolveu sugestões desta vez. Tente de novo." };
    const juntas = validarEdicoes(texto, r.brutas, r.avisos);
    juntas.edicoes.sort((x, y) => texto.indexOf(x.trecho) - texto.indexOf(y.trecho));
    if (r.falhou) {
      juntas.avisos.push("Uma parte do texto não foi analisada (a IA não respondeu); rode de novo para conferir o restante.");
    }
    return juntas;
  } catch (erro) {
    console.error("[modelo-ia] falha:", erro);
    return { erro: "Não foi possível consultar a IA agora. Tente de novo em instantes." };
  }
}
