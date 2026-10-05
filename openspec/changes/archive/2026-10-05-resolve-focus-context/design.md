## Context

A fotografia da tela (T16) tem um campo `focus` previsto no contrato, mas hoje `buildScreenSnapshot` o preenche fixo (`modalStack: 0`, `activeItemId: null`, `activeTab: null`, `hasUnsavedChanges: false`) e `compactScreenSnapshot` (`apps/api/src/routes/assistant.ts`) **descarta** `focus` do contexto do modelo. O `ItemModal` já mantém `childStack` (subtarefas abertas sobre o pai) e `activeArea` (`details | subtasks | checklists | links | attachments | activity`), mas nada disso chega ao agente. O `assistantSelectedItem` do `BoardScreen` usa a modal **principal** (`itemModalId`), ignorando o topo do `childStack`. Resultado: "este card"/"aqui"/"nesta lista" não têm alvo.

## Goals / Non-Goals

**Goals:**

- Representar na fotografia: pilha de modais, item em primeiro plano, aba/área ativa e objeto interno selecionado.
- Resolver "este card" pelo item do topo da pilha (subtarefa sobre o pai), não pela modal principal.
- Entregar `focus` no contexto autoritativo do modelo e permitir resolver aba/objeto interno.
- Perguntar quando houver ambiguidade real (mais de uma checklist/registro candidato).
- Manter tudo aditivo e validar acesso antes de usar IDs da tela.

**Non-Goals:**

- Implementar as ferramentas de CRUD de checklist/link/apontamento (T21/T22) — T19 entrega o **alvo resolvido**, não a operação.
- Métricas (T20), comandos de interface (T17, entregues) e automação genérica de navegador.

## Decisions

### 1. Foco aditivo no contrato (sem bump de schemaVersion)

Manter `modalStack: number` (profundidade) e adicionar campos opcionais a `AssistantScreenSnapshot.focus`:

- `modalPath?: Array<{ itemId: string; type: ItemType }>` — pilha ordenada raiz→topo.
- `activeItemId` (já existe) — passa a ser o **item do topo**.
- `activeTab` (já existe) — passa a ser a **área ativa** do item (`details|subtasks|checklists|links|attachments|activity`).
- `activeEntity?: { kind: 'checklist' | 'checklist_item' | 'link' | 'work_log' | 'attachment'; id: string; parentId?: string | null } | null` — objeto interno selecionado.
- `hasUnsavedChanges` (já existe) — preenchido.

- **Por quê:** aditivo não quebra consumidores nem exige rejeitar snapshots antigos; campos ausentes degradam para "sem foco". Bump de versão seria cerimônia sem ganho (o snapshot é client↔server no mesmo deploy).
- **Alternativa:** trocar `modalStack` para array — breaking; rejeitada.

### 2. Publicação do foco por store em memória por aba

Criar um store de foco por aba (em memória, sem `localStorage`), no padrão do `assistantViewStore`: o `ItemModal` publica `{ modalPath, activeItemId, activeTab }` (a partir de `childStack`/`activeArea`) e os controles internos publicam `activeEntity`; desmontar a modal remove seu nível da pilha e restaura o foco anterior. O `AppShell`/`BoardScreen` leem o store ao montar a fotografia.

- **Por quê:** evita threading de props por `BoardModals` e mantém o foco isolado por aba.
- **Alternativa:** callback via props até o `BoardScreen` — acoplamento e muitos níveis; rejeitada.

### 3. Resolução do alvo no servidor

`resolveSelectedItem` usa `focus.activeItemId` (topo) quando presente; senão o `itemId` da mensagem; senão a modal principal. `focus.activeTab`/`activeEntity` viajam no contexto autoritativo para o modelo escolher a ferramenta; o harness expõe o alvo resolvido para as ferramentas de recurso interno (consumido por T21/T22).

- **Por quê:** o servidor é o ponto autoritativo de acesso; a resolução por topo de pilha é determinística.
- **Alternativa:** resolver no cliente — não validaria acesso nem entraria no contexto do modelo.

### 4. Ambiguidade pergunta, não adivinha

Quando a aba ativa tem múltiplos candidatos e não há `activeEntity`, o agente SHALL fazer uma pergunta curta (ex.: "qual destas checklists?") em vez de escolher a primeira/última. O resolvedor pode sinalizar `ambiguous` com os candidatos.

- **Por quê:** evita mutação no recurso errado (risco citado no card e no documento de evolução).

### 5. Incluir `focus` no contexto compacto do modelo

`compactScreenSnapshot` e `AssistantPromptContext.screenSnapshot` passam a incluir `focus` (pilha, item ativo, aba, entidade), com os mesmos limites de payload.

- **Por quê:** hoje o modelo nunca vê o foco; sem isso a resolução não tem efeito.

### 6. Validação strict atualizada na mesma change

`assistantScreenSnapshotSchema.focus` é `.strict()`; os novos campos entram no schema junto com o contrato (evita o drift que causou o erro `Unrecognized key` do T18) e ganham teste de contrato.

## Risks / Trade-offs

- **[Drift entre contrato e schema Zod]** → atualizar `apps/api/src/validation.ts` na mesma change + teste de contrato do snapshot com foco.
- **[Foco obsoleto ao desmontar modal]** → publicar/limpar no unmount e restaurar o nível anterior da pilha.
- **[Vazamento entre abas]** → foco em memória por aba; nunca em `localStorage`.
- **[Seleção interna volátil]** → sem `activeEntity`, o agente pergunta; nunca escolhe arbitrariamente.
- **[IDs da tela tratados como permissão]** → validar projeto/acesso antes de usar qualquer ID do foco.

## Migration Plan

- Aditivo, sem migração de dados. Clientes antigos (sem foco) continuam válidos; o modelo apenas não recebe foco.
- Rollback reverte o comportamento; nenhum estado persistido novo (foco é volátil).

## Open Questions

- `activeTab` deve ser um enum de áreas (tipado) ou string livre? (proposta: enum alinhado ao `ItemArea` do `ItemModal`)
- Limite da pilha de modais no payload (proposta: mesmo teto de profundidade da hierarquia, ex.: 20).
- O foco precisa sobreviver a um refresh da aba (sessionStorage) ou basta memória?
