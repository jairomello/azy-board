## Why

Ao abrir um projeto no board, o usuário não vê o nome do projeto em nenhum lugar da tela. O breadcrumb atual exibe apenas "Projetos › Board", sem identificar qual projeto está aberto. Isso dificulta a orientação quando o usuário trabalha com múltiplos projetos ou navega por links diretos.

## What Changes

- O breadcrumb do header do board passa a exibir o nome do projeto após "Board": `Projetos › Board · <Nome do Projeto>`
- O `BoardPage` carrega o nome do projeto via `GET /projects/:projectId` no momento em que os demais dados são buscados
- O nome do projeto também é definido como `document.title` da página para orientação na aba do browser

## Capabilities

### New Capabilities
- `board-project-name-breadcrumb`: Exibe o nome do projeto no breadcrumb do header do board

### Modified Capabilities
- (nenhuma — alteração puramente aditiva no header)

## Impact

- **Frontend**: `BoardPage.tsx` — adiciona estado `projectName`, inclui chamada a `GET /projects/:projectId` no `Promise.all` de inicialização, atualiza o `<nav>` do header e `document.title`
- **API**: nenhuma mudança — `GET /projects/:projectId` já existe e retorna `name`
