## Why

A primeira execução da aplicação revelou que diversas funcionalidades essenciais do board Kanban estão ausentes ou com comportamento incorreto: não é possível criar cards, éditar cards, gerenciar épicos e histórias pela UI, nem a Tree View é renderizada. Além disso, o drag-and-drop de cards e colunas não funciona corretamente. Esses problemas impedem o uso básico do produto.

## What Changes

- **Criação de cards**: botão "+" em cada coluna do board para adicionar novo card
- **Edição inline de cards**: duplo clique no título do card ativa campo de edição in-place; duplo clique em qualquer outra área abre modal completa de edição
- **Modal completa do card**: formulário com todos os campos (título, descrição, prioridade, responsável, story, tags, pontos, datas, subtasks)
- **Gerenciamento de épicos e histórias**: interface para criar, editar e listar épicos e histórias diretamente do board (painel lateral ou modal)
- **Correção do drag-and-drop de cards**: cards devem fixar na coluna destino ao soltar, assumindo automaticamente o status base da coluna
- **Reordenação de colunas**: arrastar colunas para trocar de posição; também disponível na tela de configurações
- **Criação e atribuição de tags**: botão para criar tags no projeto; seletor de tags no modal de edição do card
- **Correção do toggle de subtasks**: comportamento correto — desativado mostra apenas tasks do primeiro nível (sem subtasks); ativado aplica a Leaf Rule e mostra apenas tasks folha
- **Implementação da Tree View**: o botão "Árvore" substitui o board por uma tabela hierárquica expansível com todos os níveis do projeto e colunas de dados das tasks

## Capabilities

### New Capabilities

- `card-creation-ui`: Botão de criação de card por coluna; formulário rápido de criação
- `card-edit-ui`: Edição inline por duplo clique no título; modal completa de edição com todos os campos
- `epic-story-ui`: Interface de criação e edição de épicos e histórias acessível do board
- `tag-ui`: Criação de tags do projeto e atribuição de tags aos cards pela UI

### Modified Capabilities

- `board-management`: Reordenação de colunas por drag-and-drop corrigida e funcional
- `card-management`: Comportamento do toggle de subtasks corrigido (Leaf Rule aplicada corretamente)
- `tree-view`: Tree View implementada e funcional ao clicar no botão de alternância de visão

## Impact

- Alterações exclusivamente no frontend (`apps/web/src/`)
- Arquivos principais afetados: `BoardPage.tsx`, `KanbanCard.tsx`, componentes novos de modais e formulários
- Dependências novas: nenhuma (tudo já instalado: dnd-kit, Tiptap, shadcn/ui)
- Sem alterações no backend ou banco de dados
