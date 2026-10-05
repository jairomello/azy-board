## Context

O Azy Agent já recebe a **fotografia da tela** (T16, `AssistantScreenSnapshot`) e já **controla filtros e navegação** (T17, `AssistantViewCommand` + store de visão por aba). O que falta é fechar o ciclo: dado um card que o usuário cita (ex.: `T42`) e não vê no board, explicar **por que** ele não aparece e oferecer **mostrá-lo** sem perder a visão atual.

Hoje a visibilidade é decidida por predicados inline no `useMemo` de `boardCards` em `apps/web/src/features/board/BoardScreen.tsx` (linhas 239-327) e pelas regras de agrupamento (`hideEmptyEpics`, `hideEmptyStories`, `storyDisplay`, `moduleViewMode`, `collapsedEpics/Modules/Stories`). Esses predicados **não são compartilhados** com o servidor, que apenas recebe o resultado (`displayedItemIds`) e os filtros de população. O snapshot não carrega o **estado de apresentação** (regra de folha/subtarefas, exibição de histórias, modo de módulos, ocultação de grupos vazios), então o agente não consegue distinguir “excluído por filtro” de “escondido por regra da visão” nem de “dentro de grupo recolhido”.

Restrições do produto que orientam o desenho: filtros são aplicados **client-side** (`board-filters`); apenas itens folha são cards móveis (Leaf Rule); toda leitura deve respeitar **acesso ao projeto/tenant** (anti-IDOR); e a ausência de um item na lista **não é prova** de exclusão (pode ser paginação, virtualização, recorte de escopo ou o item nem pertencer ao projeto).

## Goals / Non-Goals

**Goals:**

- Fonte única de verdade da visibilidade, compartilhada entre a interface e o agente, com **motivos tipados** e determinísticos.
- Responder “por que o card X não aparece?” com a **causa comprovada** (ou declarar que não foi possível determinar), sem inventar exclusão.
- Oferecer “mostrar esse card” neutralizando apenas os motivos responsáveis, **preservando a visão anterior** para restauração.
- Respeitar acesso ao projeto: nunca revelar conteúdo (título/descrição) de item sem permissão.
- Manter tudo aditivo e sem migração de dados.

**Non-Goals:**

- Foco de modais/abas e “este card” (T19); métricas oficiais (T20); automação genérica de navegador.
- Mutar dados (permanece somente-leitura do ponto de vista de domínio).
- Detectar dependências entre cards ou explicar ausência por causas externas ao board (permissão de projeto à parte).

## Decisions

### 1. Avaliador compartilhado em `packages/ui-contracts`

Criar `evaluateItemVisibility(item, viewState)` em `packages/ui-contracts/src/` (domínio “board adapter”, já importado por `apps/api` e `apps/web`). Retorna `{ visible: boolean; reasons: ItemVisibilityReason[] }`.

- **Por quê:** `ui-contracts` já hospeda `toCard`, `Card`, `AncestorNode` e helpers de board, é consumido pela API e pelo web, e evita um package novo. Atende ao requisito de “compartilhar a lógica de visibilidade com a interface”.
- **Alternativas:** (a) manter só no `apps/web` — o servidor não conseguiria explicar; (b) novo `packages/board-visibility` — mais cerimônia sem ganho, pois `shared-package-architecture` já define os domínios.

### 2. Explicação avaliada no servidor com o snapshot + item carregado

A ferramenta `explain_item_visibility` roda no harness: resolve o item (por `itemId` **ou** `sequenceCode`, ex.: `T42`), carrega ancestrais, vínculos de sprint/tags e o módulo do épico com verificação de membership, e aplica `evaluateItemVisibility` usando o estado de visão da fotografia.

- **Por quê:** o servidor é o ponto autoritativo para acesso e já monta o contexto do modelo; um round-trip request/response cliente↔servidor para o cliente avaliar seria novo e frágil. A fotografia já viaja na mensagem.
- **Alternativa:** pedir ao cliente para avaliar via novo canal de resposta — rejeitada por complexidade e por não permitir a checagem de acesso server-side antes de responder.

### 3. Taxonomia de motivos tipados e ordem determinística

`ItemVisibilityReason` como união discriminada com código e dados do motivo:

- `ARCHIVED` — item arquivado (fora da população carregada).
- `FILTER` — `{ field, value }` de cada filtro de população que exclui (module, sprint `IS_EMPTY`/vínculo, version, assignee, squad, costCenter, author, status, priority, types, tag).
- `MODULE_TAB` — épico do item em módulo diferente da aba ativa (só quando `moduleViewMode = 'tabs'`).
- `SUBTASK_HIDDEN` — item é subtarefa e `showSubtasks = false` (regra de folha).
- `COLLAPSED_GROUP` — item dentro de épico/história/módulo recolhido (presente no resultado, mas não visível).
- `EMPTY_GROUP_HIDDEN` — épico/história oculto por `hideEmptyEpics`/`hideEmptyStories`.
- `ACCESS_DENIED` — sem acesso ao projeto/item (a explicação para aqui e não revela conteúdo).
- `UNKNOWN` — não foi possível determinar com o estado disponível (não afirmar exclusão).

Ordem: `ACCESS_DENIED` > `ARCHIVED` > `FILTER` > `MODULE_TAB` > `SUBTASK_HIDDEN` > `EMPTY_GROUP_HIDDEN` > `COLLAPSED_GROUP` > `UNKNOWN`. O texto humano é derivado por i18n a partir do código + payload, nunca embutido no contrato.

### 4. Estado de apresentação aditivo no snapshot (sem bump de versão)

Adicionar `view.presentation` opcional em `AssistantScreenSnapshot`: `{ showSubtasks, storyDisplay, moduleViewMode, hideEmptyEpics, hideEmptyStories }`, capturado pelo `buildScreenSnapshot`. Campos opcionais; `schemaVersion` permanece `1`.

- **Por quê:** campos aditivos não quebram consumidores; ausência degrada a explicação de regras de visão para `UNKNOWN` em vez de erro. Um bump de versão exigiria rejeitar snapshots antigos sem ganho real.
- **Alternativa:** colocar em `filters` — rejeitada: `buildScreenSnapshot` documenta que estados de apresentação **não** contam como filtro de população, e misturá-los mudaria o cálculo de `scope` (`ALL`/`FILTERED`).

### 5. Revelação via novo comando `reveal_item`

Novo `AssistantViewCommandType` `reveal_item` com `itemId`. O store de visão por aba (T17) aplica: recomputa `evaluateItemVisibility` com o **estado vivo da aba** (mais autoritativo que o snapshot), neutraliza apenas os motivos responsáveis (trocar aba de módulo, expandir grupo, desligar filtro/regra), grava checkpoint no histórico existente e sinaliza a abertura do item. `restore_previous_view` restaura a visão anterior.

- **Por quê:** reutiliza o mecanismo de checkpoint já existente e mantém a mudança de visão atômica e reversível.
- **Alternativa:** compor `set_board_filters` + `open_item` a partir do servidor — rejeitada: o servidor não conhece o estado vivo exato e a composição não garante restauração coerente.

### 6. Somente-leitura, fora do catálogo MCP

`explain_item_visibility` e `reveal_item` entram na superfície de UI do assistente (mesma política de T17): sem aprovação, sem mutação de dados, e **não** expostas no catálogo MCP.

## Risks / Trade-offs

- **[Drift entre os predicados inline e o avaliador compartilhado]** → `BoardScreen` passa a usar o avaliador (ou helpers dele) para `boardCards`/grupos; adicionar teste de paridade que garanta que o conjunto visível do board coincide com `visible = true` do avaliador para uma matriz de filtros.
- **[Snapshot desatualizado em relação ao estado vivo]** → a explicação usa a fotografia e declara `UNKNOWN` quando faltam dados; a revelação usa o estado vivo da aba, não o snapshot.
- **[Vazamento de informação sem acesso]** → validar membership/projeto antes de responder; `ACCESS_DENIED` interrompe a explicação e nunca devolve título/descrição.
- **[Custo de carregar item + ancestrais + catálogos por pergunta]** → reutilizar consultas existentes de item/board; limitar a uma resolução por pedido e não varrer o projeto inteiro.
- **[Crescimento do chunk do board]** → mover a lógica para `ui-contracts` tende a reduzir código inline; monitorar `bun run check:bundle` e aplicar `lazy`/`Suspense` se necessário.
- **[Ambiguidade de itens que só existem como agrupadores/virtuais]** → tratar STORY/EPIC exibidos como agrupadores separadamente; se o alvo for agrupador, explicar a regra de apresentação em vez de “card oculto”.

## Migration Plan

- Aditivo e sem migração de dados. `schemaVersion` do snapshot e do comando permanecem `1`.
- Deploy único; clientes antigos continuam válidos (campos/comandos novos ignorados).
- Rollback: reverter o commit; nenhum estado persistido novo a limpar (o overlay de visão já é por sessão).

## Open Questions

- Como nomear/rotular o motivo quando o item **não pertence ao projeto atual** (fora de escopo × `UNKNOWN`)?
- Limite de motivos exibidos e forma de agrupá-los quando há muitos filtros ativos.
- Se `reveal_item` deve também expandir a árvore até o item no modo tree, ou apenas trocar modo/aba e abrir a modal.
