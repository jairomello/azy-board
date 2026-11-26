# Tasks

## 1. Carregamento sob demanda

- [x] 1.1 Importar a `TreeViewPage` com `React.lazy` no `BoardScreen`, mantendo só o import de tipo de `TreeActionContext`.
- [x] 1.2 Envolver a Árvore em `Suspense` com indicador de carregamento no canvas.
- [x] 1.3 Carregar `MemberDialog` e `VersionDetailModal` com `React.lazy` nas seções das Configurações, dentro de `Suspense`.

## 2. Orçamento

- [x] 2.1 Adicionar as regras dos chunks `TreeViewPage`, `MemberDialog` e `VersionDetailModal` em `bundle-budget.json` sem alterar os tetos existentes.

## 3. Verificação

- [x] 3.1 `bun run build:web` e `bun run check:bundle`: `BoardPage` 50,26 KB, `TreeViewPage` 12,15 KB.
- [x] 3.2 Contrato estrutural `carregamento-sob-demanda-contract` reprova import estático (uma ou várias linhas, `export … from`) dos três módulos.
- [x] 3.3 Caracterização A4-01 (troca para a Árvore pela barra monta a Árvore e busca `/items/tree`) segue verde.
- [x] 3.4 Caracterizações das Configurações (adicionar/editar membro, detalhe da versão) seguem verdes.
- [x] 3.5 `bun run check`, `bun run test:web`, `bun run openspec:validate`.
