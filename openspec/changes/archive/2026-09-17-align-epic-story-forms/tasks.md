## 1. Preparação E Contratos

- [x] 1.1 Mapear no `BoardPage` os fluxos de abertura, criação, edição e callbacks de `EpicModal` e `StoryModal`, confirmando que nenhum endpoint novo é necessário.
- [x] 1.2 Confirmar que `children`, checklists, `audit`, `work-log` e `PATCH /items/:itemId` atendem épico e história por `itemId`, sem alteração de backend.
- [x] 1.3 Atualizar os testes de contrato que exigem accordions em `EpicModal`/`StoryModal` para validar o novo layout, áreas, painel de propriedades e payloads preservados.

## 2. Primitivas Compartilhadas E Casca Visual

- [x] 2.1 Extrair o cabeçalho de detalhe (ícone do tipo via `itemTypeMeta`, breadcrumb, `InlineEdit`, badges de tipo/código e fechar) como componente de apresentação.
- [x] 2.2 Extrair a navegação de áreas acessível com `role="tab"`, `aria-selected`, `aria-controls`, contagens e resumos.
- [x] 2.3 Extrair o painel de propriedades agrupado por seções, reutilizável por Épico e História.
- [x] 2.4 Implementar a casca ampla e responsiva: backdrop, `role="dialog"`, `aria-modal`, cabeçalho/rodapé fixos e rolagem apenas no conteúdo.
- [x] 2.5 Confirmar que a extração não altera a `ItemModal` e que os testes de contrato existentes continuam passando.

## 3. Migração Da EpicModal

- [x] 3.1 Reestruturar `EpicModal` no novo layout com área inicial Detalhes contendo a descrição rica.
- [x] 3.2 Mover Módulo (obrigatório), Versão (opcional) e Código para o painel de propriedades, preservando valores controlados.
- [x] 3.3 Integrar as áreas Subtasks, Checklists e Histórico com os painéis e contagens por `itemId`.
- [x] 3.4 Preservar `handleSave`, defaults de criação, validação de título/módulo, loading, erro e fechamento somente após sucesso.

## 4. Migração Da StoryModal

- [x] 4.1 Reestruturar `StoryModal` no novo layout com narrativa (Como/Eu quero/Para que), descrição, critérios de aceitação e notas em Detalhes.
- [x] 4.2 Mover Épico pai (obrigatório), Versão (opcional) e Código para o painel de propriedades.
- [x] 4.3 Integrar as áreas Subtasks, Checklists e Histórico com os painéis e contagens por `itemId`.
- [x] 4.4 Preservar `handleSave`, defaults de criação, validação de título/épico, tratamento de erro e payload de campos ágeis.

## 5. Recursos Relacionados E Navegação

- [x] 5.1 Estender `CardChildrenSection` para informar o tipo do filho na abertura.
- [x] 5.2 Ajustar o `BoardPage` para abrir `StoryModal` quando o filho é `STORY` e `ItemModal` quando é `TASK`/`BUG`.
- [x] 5.3 Garantir que falhas de consultas auxiliares não bloqueiem editar/salvar e que estados vazios sejam explícitos por área.
- [x] 5.4 Preservar Escape, backdrop, foco e fechamento do nível superior com painéis e áreas abertas.

## 6. Internacionalização, Acessibilidade E Responsividade

- [x] 6.1 Adicionar ou ajustar chaves PT-BR, EN e ES para áreas, propriedades, contagens, estados vazios, erros e labels acessíveis.
- [x] 6.2 Validar `role="dialog"`, `aria-modal`, título acessível, tabs/controls, foco visível, ordem de tabulação e foco de retorno.
- [x] 6.3 Garantir que tipo, status e prioridade tenham indicação textual, sem depender apenas de cor.
- [x] 6.4 Validar desktop (duas colunas) e mobile (empilhado) sem rolagem horizontal e com Cancelar/Salvar acessíveis.

## 7. Testes E Verificação

- [x] 7.1 Testar estado inicial em Detalhes, alternância de áreas, contagens e estados vazios em Épico e História.
- [x] 7.2 Testar criação, edição, cancelamento, Escape, backdrop, erro de salvamento e preservação de valores não salvos.
- [x] 7.3 Testar subtasks, checklists, auditoria, diário de trabalho e abertura de filho pelo tipo correto.
- [x] 7.4 Testar responsividade, foco, labels acessíveis e ausência de dependência exclusiva de cor.
- [x] 7.5 Executar `bun run check` e `bun run test:smoke`, corrigindo regressões antes de concluir a implementação.

## 8. Ajustes De Escopo Por Tipo De Item

- [x] 8.1 Remover a área de Checklists de `EpicModal` e `StoryModal`, já que épico e história não possuem checklists.
- [x] 8.2 Tornar a área de filhos variável por tipo: épico lista Histórias, história lista Tasks e task/subtask lista Subtasks, com título e estado vazio próprios.
- [x] 8.3 Exibir apenas auditoria no Histórico de épico e história, removendo o diário de trabalho dessas modais.
- [x] 8.4 Adicionar as chaves `areaStories`, `areaTasks`, `childrenEmptyStories`, `childrenEmptyTasks` e `childrenEmptySubtasks` em PT-BR, EN e ES.
- [x] 8.5 Atualizar testes de contrato e artifacts (proposal/design/specs) para o novo escopo.
- [x] 8.6 Reexecutar `bun run check`, `bun run check:i18n` e `bun run test:smoke`.
