## Context

O T16 entregou a fotografia do contexto da tela (`agent-screen-context`): o `AppShell` publica `AssistantPageContext` (tela, projeto, `boardView`, `filters`, `screenSnapshot`) e o `AzyAgentDrawer` a envia na mensagem; o servidor fixa o snapshot no run e o usa no escopo de `update_items`. O T16 declarou explicitamente como Non-Goal "comandos de navegação/filtros pelo chat".

O encanamento atual (levantado no checkout):

- **Execução por fila + SSE**: `POST /conversations/:id/messages` responde `202 {runId}` e o progresso sai em `GET /runs/:runId/events` (SSE), com cursor/`Last-Event-ID`; o `AzyAgentDrawer` consome os eventos num único handler (`AzyAgentDrawer.tsx:145-214`). Os tipos de evento vivem em `packages/assistant-contracts/src/index.ts:9` e são espelhados em `apps/api/src/persistence/models.ts:631` e nos enums de banco (SQLite e Postgres).
- **Resultado de tool é lossy**: `TOOL_COMPLETED` carrega `summary(result)` (reduz a `{type, keys}`), então o web **não recebe o resultado estruturado** de ferramentas de leitura.
- **Estado de visão é local e compartilhado**: `view`, `activeModuleId`, `filters` e `itemModalId` vivem em `useState` dentro de `BoardScreen.tsx` (`:90-107`); filtros são persistidos em `localStorage` sob `board-filters:<projectId>` (compartilhado entre abas). Não há rota para a árvore (a troca é só estado) e não existe histórico de visão.
- **Abertura de card tem deep-link**: `BoardScreen` lê `?itemId=` (`:124-127`).
- **Barramento desacoplado já existe**: `notifyAssistantMutation` → CustomEvent `window` → `useAssistantCacheInvalidation` (`apps/web/src/lib/dataEvents.ts`), padrão reaproveitável para transporte interno.

Restrições: sem dependências novas; i18n PT-BR/EN/ES; licenças MIT/Apache/BSD; `bun run check`, `test:smoke`, `check:bundle` (chunk `BoardPage`) e `check:mcp-catalog`.

**Board ref:** `b175146b-1a42-4f31-9d67-492d04bcb7fb` (T17).

## Goals / Non-Goals

**Goals:**

- Permitir que a conversa aplique filtros reais, alterne Kanban/árvore, defina o módulo ativo, abra um card e volte à visão anterior, com confirmação verificável do recorte aplicado.
- Introduzir um **contrato tipado e versionado** de comandos de interface, com resultado sucesso/erro e sem mutação de dados.
- Isolar o estado aplicado **por aba do navegador**, sem vazar para outras abas.
- Manter a superfície do agente limitada a ferramentas seguras (somente-leitura de UI), sem expô-las a agentes MCP externos.

**Non-Goals:**

- Foco de modais/abas e resolução de “este card” (T19) e métricas oficiais (T20).
- Automação genérica de navegador (clicar elementos, preencher formulários).
- Mutação de dados pela conversa (já coberta por `agent-screen-context`).
- Nova rota de aplicação para a árvore ou refatoração ampla do roteamento.
- Corrigir a lacuna pré-existente de persistência do modo de visualização por projeto (`board-view-state-per-project`): o comando define o modo na sessão da aba.

## Decisions

### D1 — Comando de UI como ferramenta somente-leitura do catálogo do assistente

As operações de interface são declaradas no **catálogo do assistente** (`apps/api/src/services/assistantTools.ts`), como ferramentas de domínio de UI com semântica somente-leitura (não mutam dados), o que as coloca no flow normal de tool-calling do modelo. O harness intercepta ferramentas de UI **antes** de `executeTool`, normaliza o comando tipado e nunca chama a API de dados nem a execução compartilhada.

Conjunto inicial: `set_board_filters` (substituir/limpar filtros), `set_board_view` (modo Kanban/árvore e módulo ativo), `open_item` (abrir card) e `restore_previous_view` (voltar).

- *Por quê:* o modelo só age por tool-calling; declarar no catálogo do assistente dá schema e descoberta corretos sem ripple no catálogo compartilhado/MCP.
- *Alternativa considerada:* interpretar texto livre no drawer. Rejeitada: sem schema tipado e imprevisível.
- *Alternativa considerada:* declarar no `packages/tool-registry` com domínio `ui`. Rejeitada na implementação: o catálogo compartilhado alimenta o MCP e é validado por `check:mcp-catalog`, exigindo mudanças em `ToolDomain`, `namespace`, `policies` e `selectSharedTools` — raio de mudança maior e risco de expor a ferramenta a agentes.

### D2 — Ferramentas de UI fora do catálogo compartilhado (e, portanto, do MCP)

Por viverem apenas no catálogo do assistente, as ferramentas de UI não entram em `SHARED_TOOL_NAMES` e **não aparecem** no catálogo MCP nem em `check:mcp-catalog`. Não é necessária qualquer alteração em `packages/tool-registry` ou `apps/mcp`.

- *Por quê:* um agente MCP (API Key) não tem tela para controlar; manter as ferramentas fora do catálogo compartilhado torna a exclusão estrutural, sem filtro/guard adicional.
- *Alternativa considerada:* declarar no compartilhado e filtrar por domínio. Rejeitada pelo ripple acima.

### D3 — Entrega reaproveita `TOOL_COMPLETED` com payload aditivo `command`

O harness normaliza o comando e o inclui num campo novo `command` do payload do evento `TOOL_COMPLETED` (que já é emitido e consumido). O web lê `data.command` no handler SSE e o publica no store de visão. Deduplicação por `commandId` e cursor do run tornam a aplicação idempotente em reconexão/replay.

- *Por quê:* evita criar um novo tipo de evento, que exigiria alterar `AssistantEventType`, `persistence/models.ts`, o enum de schema SQLite e o `CHECK` do Postgres (com migração) — custo e risco altos para um payload aditivo.
- *Alternativa considerada:* evento dedicado `UI_COMMAND`. Viável, porém mais caro (migração de enum); fica como evolução se o payload crescer.

### D4 — Store de visão por aba (`sessionStorage`) + assinatura pelas telas

Cria-se um `AssistantViewStore` por aba (chave versionada por projeto em `sessionStorage`), com o estado de visão aplicado e a pilha de histórico. `BoardScreen` e `TreeViewPage` assinam o store e aplicam as mudanças sobre o estado local, usando a mesma semântica do toolbar (incluindo `EMPTY_FILTER_VALUE`/`IS_EMPTY`). O drawer só publica o comando recebido no store.

- *Por quê:* o estado de visão é local a cada aba (React), e `sessionStorage` isola naturalmente; centraliza a aplicação e o histórico, testável sem UI.
- *Alternativa considerada:* colocar o estado no `AssistantContext`/`AppShell`. Rejeitada: o contexto é do agente, não um store de visão; misturaria responsabilidades.

### D5 — Semântica dos comandos

- `set_board_filters`: **substitui** o conjunto de filtros pelo informado (não faz merge implícito); `clear_board_filters` (ou filtros vazios) limpa. Ausência de valor usa operador tipado (`IS_EMPTY`), nunca o sentinela da interface como nome de entidade.
- `set_board_view`: define `mode` (`kanban` | `tree`) e, opcionalmente, `activeModuleId`; aplicado em memória (sem rota).
- `open_item`: abre o `ItemModal` do item validado; preserva o deep-link `?itemId=` para navegação direta.
- `restore_previous_view`: restaura o último checkpoint e o remove da pilha.

- *Por quê:* regras explícitas evitam ambiguidade do modelo e mantêm paridade com a interface (o card exige que “o resultado na tela coincide com o escopo descrito”).

### D6 — Histórico limitado e por aba

A pilha guarda checkpoints de `{filters, mode, activeModuleId, openItem}` antes de cada mudança de visão (aplicada por comando ou pelo usuário), limitada (ex.: 20 entradas) e por aba. Restaurar não cruza projetos nem abas.

- *Por quê:* “volte para a visão anterior” exige um alvo determinístico; limitar evita crescimento e mantém o store leve para o orçamento de bundle.
- *Alternativa considerada:* usar o histórico do navegador (`navigate(-1)`). Rejeitada: a troca de modo não é rota e o histórico do navegador mistura navegação de página.

### D7 — Isolamento por aba vs. preferência durável

O estado aplicado pelo agente vive só no overlay de sessão (`sessionStorage`) e **nunca** é gravado no `localStorage` de preferências. As preferências duráveis do usuário (`board-filters:<projectId>` e densidade) permanecem; o overlay de sessão prevalece enquanto existir na aba.

- *Por quê:* atende “isolar o estado por aba do navegador” e evita que aplicar um filtro numa aba mude as outras — o conflito direto com `board-filters-persistence`.
- *Trade-off:* duas fontes de estado de filtro (preferência durável + overlay de sessão); a ordem de precedência é explícita e testada.

### D8 — Segurança, validação e limites

Comandos são **referências validadas, nunca permissões**: o servidor confere acesso ao projeto e a existência do item antes de emitir o comando (mesma regra anti-IDOR); o cliente valida o envelope e ignora comando malformado/desconhecido com erro acionável no chat, sem alterar a tela. O comando é aplicado apenas na aba que originou o run (owner). Sem aprovação (não há mutação). Limites: tamanho do payload de filtros, quantidade de valores por filtro e tamanho do histórico.

- *Por quê:* o modelo pode errar ou ser induzido; a imposição de escopo e acesso é do servidor, como no T16, e o texto de cards continua sendo dado, não instrução.

### D9 — Confirmação no chat com os rótulos de escopo existentes

Após aplicar, o resultado da ferramenta alimenta a confirmação no chat (ex.: “Filtro aplicado: tipo = Bug; versão vazia · resultado atual”), reutilizando `scopeAll`/`scopeFiltered` de T16; erro de comando produz mensagem acionável. i18n nos três locales.

## Risks / Trade-offs

- **[Ferramentas de UI vazarem para o catálogo MCP] →** exclusão por domínio/namespace + guard `check:mcp-catalog` com teste.
- **[Vazamento entre abas via `localStorage`] →** overlay de sessão (`sessionStorage`) com precedência explícita e teste de isolamento; o comando nunca grava preferência durável.
- **[Modelo emite filtro/comando inválido] →** normalização e validação no harness + validação no cliente; comando inválido é no-op com erro no chat, sem mexer na tela.
- **[Reconexão/replay do SSE reaplica comando] →** deduplicação por `commandId` + cursor do run.
- **[Custo de bundle no chunk `BoardPage`] →** store pequeno e sem dependências novas; medir com `check:bundle`.
- **[Escopo invadir T19/T20] →** Non-Goals explícitos (foco de modais, métricas).
- **[Duas fontes de filtros (durável × sessão) confundirem o usuário] →** precedência documentada; “limpar filtros” no toolbar limpa ambos na sessão corrente.

## Migration Plan

Mudança aditiva, sem migração de banco: o campo `command` no payload do evento é opcional; clientes antigos ignoram. Ferramentas de UI entram no catálogo do assistente sem alterar as ferramentas MCP. Rollback: remover as ferramentas de UI e o campo do evento restaura o comportamento atual (o board segue lendo filtros do `localStorage`).

## Open Questions

- Filtros aplicados por comando devem **substituir** ou **mesclar** com os já ativos? Proposta: substituir (com `clear` explícito); mesclar pode ser um modo futuro.
- O histórico deve registrar também mudanças manuais do usuário (para “voltar” cobrir tudo) ou apenas comandos do agente? Proposta: registrar ambas, com limite.
- A troca de modo por comando deve persistir entre recargas? Proposta: não nesta change (sessão da aba); persistir modo por projeto é a lacuna separada de `board-view-state-per-project`.
