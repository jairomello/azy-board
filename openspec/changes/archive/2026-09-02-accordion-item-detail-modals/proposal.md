## Why

As modais de detalhe do Board concentram muitos campos e seções, especialmente em Tasks e Bugs, o que torna difícil localizar informações e visualizar textos longos. Accordions permitem focar na seção relevante, reduzir rolagem e manter um resumo útil do conteúdo sem perder acesso aos campos.

## What Changes

- Organizar as seções das modais de Épico, História, Task, Bug e Subtask em accordions recolhíveis.
- Abrir somente a primeira seção por padrão ao iniciar uma modal; demais seções começam recolhidas.
- Adicionar controles "Recolher tudo" e "Expandir tudo" em cada formulário.
- Exibir resumos na barra de cada accordion, como progresso `X/Y` e barra visual de checklists.
- Manter dados, validações, payloads, rich text, salvamento e cancelamento existentes.
- Preservar o comportamento de modais empilhadas para subtasks e a navegação por teclado.
- Adicionar estados acessíveis, foco, ARIA, responsividade e traduções PT-BR/EN/ES.
- Não alterar o modelo de dados nem tornar campos obrigatórios.

## Capabilities

### New Capabilities

- `accordion-item-detail-forms`: interação, estado e resumos dos accordions nas modais de detalhe.

### Modified Capabilities

- `card-edit-ui`: a modal completa de edição passa a organizar seus campos em accordions sem alterar seus dados ou ações.
- `card-creation-ui`: modais de criação de Épico e História passam a organizar seções extensas com o mesmo padrão.

## Impact

- `apps/web/src/components/ItemModal.tsx`, `EpicModal.tsx`, `StoryModal.tsx` e componentes compartilhados de formulário.
- Componentes de accordion, resumo de checklist e traduções.
- Testes frontend de estado inicial, expansão/recolhimento, resumos, teclado e modal empilhada.
- Nenhuma alteração de API, banco ou contrato de integração.
