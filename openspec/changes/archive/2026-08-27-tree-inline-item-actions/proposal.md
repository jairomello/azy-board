## Why

A visão em árvore atualmente permite navegar pela hierarquia, mas exige sair dela para criar itens ou abrir a edição completa. Isso interrompe o fluxo de planejamento, especialmente quando o usuário já está no contexto correto de módulo, épico, história ou task.

## What Changes

- Exibir ações de inclusão diretamente na visão em árvore para os tipos permitidos: módulo, épico, história, task e bug.
- Abrir o formulário ou modal de criação com o contexto do nó selecionado, preenchendo automaticamente o pai quando aplicável.
- Exibir um botão de editar em cada linha da árvore.
- Abrir a modal completa de edição do item ao acionar o botão de editar, sem exigir navegação para o Kanban.
- Respeitar permissões, hierarquia válida e atualização da árvore após criação ou edição.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `tree-view`: adicionar ações de criação contextual e edição completa por linha na visão em árvore.

## Impact

- Componentes frontend da Tree View, linhas hierárquicas e ações de item.
- Integração com os fluxos existentes de criação de módulo e de itens via `/projects/:id/items`.
- Reutilização da modal completa de edição e atualização dos dados exibidos na árvore após mutações.
- Testes de interface e integração para ações por tipo, contexto pai, permissões e atualização da árvore.
