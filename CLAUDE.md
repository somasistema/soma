@AGENTS.md

# SOMA — regras do projeto

Sistema de contratos e regularização de imóveis (Next.js 16 + Supabase, schema `soma`). Português nos textos de tela, commits e comentários.

## Regras de trabalho
- **Migrations**: escreva o `.sql` em `supabase/migrations/` (próximo número da sequência) e **não aplique**. O Gustavo roda no SQL Editor. Funções grandes são re-emitidas inteiras a cada mudança: gere o arquivo por script a partir da migration anterior, em vez de copiar à mão, e teste.
- **Commit/push só quando pedido**, e **sem** `Co-Authored-By` nos commits deste projeto.
- **Segredos** só em `.env.local` (nunca imprimir nem commitar). Documentos reais de clientes têm dado pessoal: ficam fora do repositório.
- Os conectores MCP de Supabase, Vercel e Drive estão ligados a outra conta: não usar para o SOMA.

## Como verificar
- `npx tsc --noEmit`, `npx eslint src` e `npx next build`. O build **não** acusa erro de módulo em tempo de execução: para mudanças em server actions, suba `next start` e abra a página.
- Banco: testes em PGlite (banco em memória) rodando a cadeia inteira de migrations. Teste a migration nova com os cenários reais antes de entregar.
- PDFs: renderize para PNG (mupdf) e olhe, não confie só no código.

## Armadilhas já vividas
- Arquivo `"use server"` só pode exportar funções async. **Não reexporte tipos** (`export type { X }`): quebra em produção com `ReferenceError`. Importe o tipo de uma lib.
- Upload por server action tem limite de corpo de 10 MB (`next.config.ts`): envie foto/arquivo um por chamada.
- Arquivos do repositório estão em CRLF; edições por script devem preservar o fim de linha. No Git Bash, heredocs com aspas e `\` quebram fácil: prefira a ferramenta de escrita para arquivos grandes.
- Leitura de documentos (OCR + IA) roda síncrona no upload: páginas com isso precisam de `maxDuration = 60`. Evite libs com `node-gyp`.

## Arquitetura que não está óbvia no código
- **Escrita no banco** é por funções `SECURITY DEFINER` (as tabelas só têm policy de SELECT). Exceções: tabelas escritas pelo servidor com `service_role` após checar o perfil (ex.: vistoria).
- **Processo de contrato** (`tp_processo = 'contrato'`) tem `tp_contrato`: `venda` ou `locacao`. Na locação o **locador é gravado como `vendedor` e o locatário como `comprador`**; só rótulos e texto mudam (`rotuloLadoParte`, `rotuloPapelAprovacao`). Dados do aluguel ficam em `processo_locacao`.
- **Minuta**: gerada de modelo (`modelos_contrato`) com `{{campos}}` e blocos `{{#campo}}…{{/campo}}` / `{{^campo}}`; o que falta vira `__________`. Fluxo: documentos → minuta → aprovação por frente → contrato → assinatura (Clicksign). Venda tem 5 frentes; na locação, locador, locatário e jurídico sempre, e corretor/imobiliária só se existirem. Cada pessoa aprova por link próprio, enviado por e-mail (Resend).
- **Link do cliente** (`/parte/[token]`, `/aprovar/[token]`) é público: a autorização é o token, revalidado dentro de funções SQL. Documentos de pessoa vão para o item certo do checklist e a leitura completa só os campos vazios da pessoa.
- **Assinatura Clicksign**: API v3, token em `CLICKSIGN_API_TOKEN`, `CLICKSIGN_SANDBOX=true` só com token do painel sandbox (conta separada), webhook em `/api/webhooks/clicksign` com HMAC (`CLICKSIGN_WEBHOOK_SECRET`).
- **IA** (`ANTHROPIC_API_KEY`, opcional): Haiku confere campos lidos; Sonnet lê documentos difíceis, detecta giro de foto e descreve ambientes da vistoria. Sonnet "pensa" antes de responder: dê folga em `max_tokens`.
