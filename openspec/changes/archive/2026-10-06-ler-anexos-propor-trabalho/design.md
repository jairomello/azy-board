## Context

O Azy Agent enxerga apenas **metadados** de anexos: `list_attachments` devolve `id`, nome, tipo e tamanho, mas nenhum caminho transforma os bytes do arquivo em texto para o modelo. Do outro lado, a API já tem o essencial:

- `GET /api/projects/:projectId/items/:itemId/attachments/:attachmentId/download` exige `VIEWER+`, ancora `getItem` + `getAttachment` por tenant/projeto/item e serve o arquivo via `storageAdapterForTenant` (`apps/api/src/routes/attachments.ts`).
- `StorageAdapter.download(storagePath)` devolve `BodyInit | null` (BunFile no local, web stream no S3), sem URL pública.
- O harness trunca cada saída de ferramenta em `HARNESS_LIMITS.toolOutputChars` (32.000 caracteres) e o system prompt já instrui que conteúdo de cards/anexos é **dado não confiável**.
- O catálogo compartilhado (`packages/tool-registry`) é a fonte única de schema, policy, routing e descrição; o MCP e o harness executam a mesma definição.

O que falta é uma **camada de leitura de conteúdo**: ler bytes de forma autorizada, extrair texto de formatos suportados, impor limites explícitos e levar o texto ao modelo como dado — sem fingir OCR nem leitura de formatos incompatíveis. O roadmap já aponta o caminho (`docs/SUGESTOES-EVOLUCAO-AZY-AGENT.md`, oportunidade #7: começar por formatos textuais; OCR é evolução separada).

## Goals / Non-Goals

**Goals:**
- Expor `read_attachment` no catálogo compartilhado (MCP + Azy Agent), como leitura autorizada por `projectId` + `itemId` + `attachmentId`.
- Extrair texto dos formatos textuais já aceitos no upload (texto, Markdown, CSV, JSON) e declarar honestamente os formatos não interpretáveis.
- Ler via `StorageAdapter` existente, reaproveitando autorização, ancoragem e configuração de provider por tenant.
- Impor limites de bytes lidos e de caracteres devolvidos, com `truncated`/`reason`/`nextOffset` — nunca truncamento silencioso.
- Tratar o conteúdo extraído como dado não confiável e delimitado no transcript.
- Fundamentar a proposta de trabalho (critérios de aceite/checklist) no texto efetivamente lido, citando o anexo de origem na prévia de aprovação, reaproveitando as ferramentas de mutação e o fluxo de aprovação vigentes.
- Manter leitura disponível mesmo com anexos **desabilitados** no tenant (upload/edição/remoção continuam bloqueados).

**Non-Goals:**
- OCR, visão multimodal, áudio, vídeo e binários compactados.
- Dependências novas de parsing nesta mudança (PDF e Office ficam como evolução separada, com ponto de extensão definido).
- Persistir/cachear texto extraído em banco (extração on-the-fly; cache é decisão futura).
- Alterar as rotas de upload/download/edição de metadados ou o comportamento de `list_attachments`.
- Criar uma ferramenta de mutação nova só para “propor”: a proposta reutiliza `batch`/`create_task`/`update_item` e as ferramentas de checklist.

## Decisions

### 1. Nova ferramenta `read_attachment` no catálogo compartilhado, como leitura

Declarar em `packages/tool-registry/src/fields.ts` os campos `projectId`, `itemId`, `attachmentId` (todos obrigatórios), em `policies.ts` a policy `read` (`VIEWER`), e em `registry.ts` a classificação `{ domain: 'evidence', scope: 'item', operation: 'read' }`, namespace `discovery`, descrição e schema de resposta.

- **Alternativa considerada:** reaproveitar o endpoint de download e entregar bytes ao modelo. Rejeitada: bytes binários não são interpretáveis pelo modelo, não têm limite de transcrição e ampliam o risco de injeção/payload.
- Como a operação é `read`, o risco derivado é `READ` e **não exige aprovação humana** — coerente com o contrato de leitura.

### 2. Extração por MIME com registro de extratores, começando pelos formatos textuais

Criar `apps/api/src/services/attachmentContent.ts` com um registro `extractorFor(mimeType)` que devolve `{ format, text, encoding }`:

- `text/plain`, `text/markdown`, `text/csv` → decodificação UTF-8 (com detecção de BOM e fallback), preservando o texto.
- `application/json` → leitura como texto e, quando possível, validação de JSON (`format: 'json'`).
- Demais MIME → `format: 'unsupported'`, sem texto, com `reason: 'unsupported_format'`.

O registro é o ponto de extensão para PDF/Office/OCR em mudanças futuras. Formatos que o upload aceita mas não sabemos ler (PDF, Office, imagens, áudio, vídeo, compactados) **não** são “lidos de forma fingida”: retornam `unsupported`.

- **Alternativa considerada:** adicionar já um parser de PDF/Office. Rejeitada nesta mudança por licença/escopo/perf e porque o roadmap define textual primeiro.

### 3. Leitura de bytes pelo `StorageAdapter` existente, com novo endpoint de conteúdo

Adicionar ao router de anexos uma leitura de conteúdo `GET /api/projects/:projectId/items/:itemId/attachments/:attachmentId/content` (guard `VIEWER`), espelhando a ancoragem e a autorização do download:

1. `getItem` (anti-IDOR) → `getAttachment` (tenant/projeto/item).
2. `storageAdapterForTenant(ctx.tenantId, attachment.storageProvider)` → `download(storagePath)`.
3. Bufferização limitada (BunFile → `arrayBuffer`; web stream → `new Response(stream).arrayBuffer()`), respeitando o teto de bytes antes de decodificar.
4. Resposta JSON com o resultado da extração (texto + metadados), nunca o caminho físico.

Leitura **não** checa `settings.enabled`, mantendo o invariante de `file-attachments` (“desabilitar bloqueia mutações e preserva leitura autorizada”). O download binário existente permanece intocado.

- **Alternativa considerada:** o pacote MCP acessar storage/banco diretamente. Rejeitada: duplicaria acesso e credenciais; o MCP continua falando HTTP com a API.

### 4. Limites explícitos e segmentação, sem truncamento silencioso

Definir em `packages/assistant-contracts/src/assistantLimits.ts`:

- `ATTACHMENT_READ_MAX_BYTES` (teto de bytes lidos do storage antes de decodificar).
- `ATTACHMENT_READ_MAX_CHARS` (teto de caracteres devolvidos), calibrado **abaixo** de `HARNESS_LIMITS.toolOutputChars` para o JSON do resultado caber no transcript.

Resposta inclui sempre `totalBytes`, `readBytes`, `charCount`, `truncated` e `reason` (`char_limit` | `unsupported_format` | `none`); quando cortado por limite, inclui `nextOffset` para o agente segmentar a leitura em vez de perder texto.

- **Alternativa considerada:** confiar no corte genérico de 32k do harness. Rejeitada: além de silencioso, o modelo não saberia o que ficou de fora nem como continuar.

### 5. Conteúdo do anexo é dado não confiável e delimitado

No harness, o resultado textual de `read_attachment` entra no transcript **delimitado e rotulado** como conteúdo de documento (ex.: bloco `<<<ANEXO filename>>> ... <<<FIM ANEXO>>>`), com neutralização de sequências que colidam com o delimitador. O texto nunca é interpretado como instrução; o system prompt já reforça que cards/anexos são dados. Nenhuma tool pode ser concedida ou parametrizada a partir do conteúdo.

- **Alternativa considerada:** injetar o texto cru como qualquer tool output. Rejeitada por risco direto de prompt injection.

### 6. Proposta de trabalho reutiliza mutação + aprovação, citando o anexo

Não criar ferramenta de “propor”. O agente lê o conteúdo e usa `batch`/`create_task`/`update_item` e as ferramentas de checklist sob o fluxo de aprovação existente. O harness registra os anexos lidos na run e **anota a prévia** com a origem (ex.: “Fonte: `requisitos.pdf` — anexo lido nesta conversa”), e o `operation hash` continua cobrindo os argumentos efetivos. Para formatos `unsupported`, a proposta é bloqueada no nível do agente: o resultado da leitura deixa explícito que não houve interpretação.

- **Alternativa considerada:** uma ferramenta `propose_work_from_attachment`. Rejeitada por duplicar mutações/aprovação e ampliar a superfície do catálogo sem ganho de segurança.

## Risks / Trade-offs

- **Prompt injection embutida no documento** → delimitador + rótulo de dado + guardrail; conteúdo não seleciona tools nem argumentos; mutações continuam exigindo aprovação humana com hash do payload real.
- **Falso “não lido” por formato não suportado (PDF/Office)** → resultado `unsupported` explícito; o agente declara a limitação e não inventa critérios; OCR/parsers são evolução separada com ponto de extensão no registro de extratores.
- **Documentos enormes inflam contexto/custo** → teto de bytes antes de decodificar + teto de caracteres abaixo do corte do transcript + `nextOffset`; leituras repetidas são deduplicadas pelo mecanismo de `seen` já existente no harness.
- **Leitura de arquivo sensível** → mesma autorização de membership (`VIEWER+`) e ancoragem tenant/projeto/item do download; a auditoria registra o nome da tool, não o conteúdo.
- **Assimetria de isolamento no Postgres** (`listAttachments` ignora `projectId`) → a rota de conteúdo sempre ancora via `getItem`/`getAttachment` server-side; a query do Postgres pode ser endurecida como melhoria defensiva.
- **DoS por leitura** → cap de bytes com abort do stream e sem decodificar acima do teto.

## Migration Plan

1. Contratos compartilhados: `read_attachment` (fields, policy, classificação, descrição, response schema) e limites de leitura.
2. API: serviço de extração + rota de conteúdo autorizada (sem migration de banco; nada é persistido).
3. MCP: `toolReadAttachment` + dispatch; regenerar README/catálogo.
4. Harness: delimitação de conteúdo não confiável, limites e anotação de origem na prévia.
5. Skill: documentar a leitura, formatos, limites e a regra de não fingir interpretação.
6. Testes e `bun run check`, `bun run test:smoke`, `bun run test:agent-skill`.
7. Rollback: remover ferramenta/rota; a mudança é somente-leitura e não altera dados, então basta reverter a aplicação.

## Open Questions

- Quais formatos além de texto/Markdown/CSV/JSON entram em seguida (PDF, DOCX) e com qual parser MIT?
- Vale persistir/cachear texto extraído para reduzir custo e latência? Com qual retenção e isolamento por tenant?
- Os tetos de bytes/caracteres devem variar por perfil de instalação (SIMPLE/ADVANCED) ou por governança do tenant?
