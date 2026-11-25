# Tasks

## 1. Carregamento sob demanda

- [x] 1.1 Importar a `TreeViewPage` com `React.lazy` no `BoardScreen`, mantendo só o import de tipo de `TreeActionContext`.
- [x] 1.2 Envolver a Árvore em `Suspense` com indicador de carregamento no canvas.

## 2. Orçamento

- [x] 2.1 Adicionar a regra do chunk `TreeViewPage` em `bundle-budget.json` sem alterar os tetos existentes.

## 3. Verificação

- [x] 3.1 `bun run build:web` e `bun run check:bundle`: `BoardPage` 50,26 KB, `TreeViewPage` 12,15 KB.
- [x] 3.2 Caracterização A4-01 (troca para a Árvore pela barra monta a Árvore e busca `/items/tree`) segue verde.
- [x] 3.3 `bun run check`, `bun run test:web`, `bun run openspec:validate`.
