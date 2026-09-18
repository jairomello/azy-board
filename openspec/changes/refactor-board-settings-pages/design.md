## Context

O card `Item 16: BoardPage e SettingsPage são god components` identifica duas páginas que acumulam responsabilidades de apresentação, estado local, efeitos assíncronos, acesso à API e coordenação de eventos. `BoardPage.tsx` tem aproximadamente 2.007 linhas e concentra carga de catálogos e itens, WebSocket, filtros, agrupamento hierárquico, drag-and-drop, mutações, árvore e modais. `SettingsPage.tsx` tem aproximadamente 1.511 linhas e mantém dez áreas de configuração com estados e operações próprios.

O frontend já possui componentes reutilizáveis, `api`, `useWebSocket`, `BoardContext`, componentes de acordeão e contratos de i18n. A solução deve aproveitar essas fronteiras existentes, preservar a URL e os contratos REST/WebSocket e evitar introduzir TanStack Query, um novo gerenciador global ou dependências externas nesta change.

Board ref: `2c14878f-dad2-4b4c-bc93-84e6f5d78436`.

## Goals / Non-Goals

**Goals:**

- Reduzir `BoardPage` e `SettingsPage` a shells de rota que conectam contexto, permissões e módulos de feature.
- Organizar o Board em módulos de dados/sincronização, filtros, layout hierárquico, interação de drag-and-drop, mutações e modais.
- Organizar Settings por seção independente, evitando que estado de uma seção vaze para outra.
- Preservar comportamento funcional, permissões, traduções, query params, eventos WebSocket, APIs e navegação.
- Tornar hooks e componentes extraídos testáveis com testes de comportamento e contratos explícitos.
- Permitir migração incremental, mantendo a aplicação compilável e executável após cada etapa relevante.

**Non-Goals:**

- Não alterar endpoints, schemas de banco, payloads ou regras de autorização do backend.
- Não implementar nesta change cache remoto, reconciliação/replay de WebSocket ou optimistic updates uniformes; esses itens pertencem à análise dos cards 17, 18 e 20.
- Não redesenhar visualmente o Board ou Settings.
- Não migrar todas as páginas do frontend para uma arquitetura nova.
- Não adicionar dependências externas ou um estado global novo.

## Decisions

### 1. Feature folders no frontend

Criar `apps/web/src/features/board/` e `apps/web/src/features/project-settings/`. Cada feature terá componentes, hooks, tipos e adaptadores locais; utilitários genuinamente compartilhados continuam em `components/` e `lib/`.

Alternativa considerada: apenas dividir os arquivos em componentes ao lado das páginas. Foi rejeitada porque não cria uma fronteira de domínio e tende a manter dependências cruzadas e estado de página espalhado.

### 2. Shells de rota finos

`BoardPage.tsx` e `SettingsPage.tsx` continuarão sendo os alvos do roteador, mas passarão a montar um `BoardScreen` e um `ProjectSettingsScreen`, fornecendo `projectId` e contexto de autenticação. A responsabilidade de buscar dados e renderizar seções ficará dentro da feature.

Alternativa considerada: trocar diretamente as rotas para novos arquivos e remover as páginas antigas de uma vez. Foi rejeitada por aumentar o risco de regressão e dificultar a revisão incremental.

### 3. Estado por responsabilidade

No Board, separar estado de catálogo/dados, filtros e preferências de visualização, estado de colapso, interação de drag-and-drop, seleções de modais e refresh provocado por mutações/tempo real. No Settings, cada seção será dona de seu formulário, carregamento relacionado e ações, enquanto o shell manterá apenas dados de contexto e composição.

O estado não será movido para um store global nesta change. Props e callbacks tipados serão usados entre o shell e os módulos, reduzindo o acoplamento sem esconder o fluxo de dados.

### 4. Adaptadores de acesso e eventos

Os novos hooks usarão o cliente `api` existente e `useWebSocket`/`onAssistantMutation` já utilizados pela aplicação. Não haverá chamadas `fetch` novas. A extração pode corrigir chamadas diretas existentes de Settings para o cliente comum quando isso for necessário para preservar o comportamento de erro e sessão, sem alterar endpoints.

### 5. Migração vertical e contratos de comportamento

Cada seção será extraída junto com seus tipos, handlers e renderização, substituindo uma responsabilidade por vez. Após cada extração, os testes deverão verificar o comportamento observável: carregamento, permissões, sucesso/erro de mutações, filtros, navegação, abertura de modais e atualização por eventos.

Testes baseados somente em presença de strings serão mantidos apenas quando documentarem um contrato estrutural; para lógica extraída, preferir testes de hooks/componentes com mocks do cliente API e eventos controlados.

## Risks / Trade-offs

- **[Risco]** A ordem de atualização de estado e efeitos pode mudar durante a extração. → **Mitigação:** migrar uma responsabilidade por vez, comparar dependências de `useEffect` e adicionar testes para mudança de `projectId`, refresh e reconexão.
- **[Risco]** Drag-and-drop depende de closures e estado compartilhado do Board. → **Mitigação:** manter `DndContext` no shell ou em um módulo único de interação, com callbacks tipados para mutações e testes de drop.
- **[Risco]** A refatoração pode alterar query params ou preferências persistidas em `localStorage`. → **Mitigação:** preservar nomes das chaves, formato dos filtros e leitura/escrita por `projectId`; cobrir troca de projeto.
- **[Risco]** Settings pode perder permissões ou estados específicos de modo do board. → **Mitigação:** manter a checagem de grupo e membership no nível da feature e testar Team Member, Member/Admin e conversão de modo.
- **[Risco]** A redução de páginas pode ser apenas cosmética se os módulos continuarem acoplados. → **Mitigação:** definir dependências permitidas e aceitar a tarefa somente com shells finos e responsabilidades visíveis nos módulos.

## Migration Plan

1. Criar os diretórios, tipos compartilhados da feature e testes de caracterização sem alterar a rota.
2. Extrair primeiro o carregamento/contexto e a composição visual, mantendo a implementação anterior como referência temporária.
3. Migrar as áreas do Board e Settings verticalmente, executando typecheck, testes e build após cada grupo.
4. Remover código duplicado das páginas e ajustar imports, contratos de texto e documentação estrutural.
5. Validar com `bun run check`, `bun run test:smoke` e testes específicos de frontend.

Rollback: cada etapa deve ser revertível por commit. Se uma extração causar regressão, retornar o shell ao módulo anterior sem alterar dados persistidos nem contratos de API.

## Open Questions

- O limite final de linhas para os shells deve ser uma métrica de revisão ou apenas a separação de responsabilidades? A proposta usa responsabilidade e acoplamento como critério principal, não um número rígido.
- A extração do cliente comum para chamadas legadas de Settings deve ser feita nesta change ou separada no card 19? Nesta change só deve ser feita quando necessária para encapsular a seção; uma migração ampla fica fora do escopo.
