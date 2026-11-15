# Tasks

## 1. Componente de progresso

- [x] 1.1 Criar `ProgressBar` compartilhado em `apps/web/src/components/` com variantes `compact` e `labeled`, suporte a valor 0–100, contagem opcional e rótulo acessível (`role="progressbar"`, `aria-valuenow`, `aria-valuetext`).
- [x] 1.2 Implementar trilho com marcas de 25/50/75%, preenchimento em gradiente `--primary` → `--status-review`, estado 100% com `--status-done` e brilho via `color-mix` dos tokens.
- [x] 1.3 Desabilitar transição/brilho animado sob `prefers-reduced-motion`.
- [x] 1.4 Testar as variantes, 0%, 100%, tema claro/escuro e rótulo acessível.

## 2. Card do Board

- [x] 2.1 Substituir a barra atual de `KanbanCard` pelo `ProgressBar` compacto, mantendo a região entre tags/tipo e rodapé e o contador de checklist.
- [x] 2.2 Manter a omissão da barra quando o avanço é 0 e a semântica de avanço no fluxo.
- [x] 2.3 Atualizar o teste de contrato da região de avanço (`board-column-advance`) para o novo componente.

## 3. Progresso na listagem de projetos

- [x] 3.1 Adicionar `includeProgress` a `GET /projects` e o tipo de resposta `progress: { advance, done, total } | null`.
- [x] 3.2 Implementar agregação em massa por projeto no port de persistência, com `// [TENANT]` e `// [DB-SWAP]` nos pontos aplicáveis, e calcular o avanço com `resolveColumnProgressWeights`/`averageAdvance` do domínio.
- [x] 3.3 Implementar o agregado nos adapters SQLite e PostgreSQL, com teste de paridade.
- [x] 3.4 Tratar falha de agregação por projeto como `progress: null`, sem derrubar a listagem.
- [x] 3.5 Testar o endpoint com e sem `includeProgress`, projeto sem folhas, arquivados e isolamento por tenant.

## 4. Tela de Projetos

- [x] 4.1 Enviar `includeProgress=true` na consulta da tela e incluir o progresso no tipo local `Project`.
- [x] 4.2 Renderizar `ProgressBar` rotulado com `NN% concluído`, `x/y entregas` e estado “indisponível” quando `progress` for null.
- [x] 4.3 Adicionar textos em pt-BR, en e es e garantir paridade de i18n.
- [x] 4.4 Testar card com progresso, 0/0, 100%, indisponível e recorte de arquivados.

## 5. Consistência e verificação

- [x] 5.1 Cobrir a igualdade do percentual entre listagem de projetos, Dashboard e Board para o mesmo conjunto de folhas.
- [x] 5.2 Rodar `bun run check`, `bun run test:smoke` e os testes de frontend afetados.
- [x] 5.3 Atualizar CHANGELOG e a wiki (cards do Board e tela de Projetos).
