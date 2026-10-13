# Tasks

## 1. Helper da URL do MCP

- [x] 1.1 Implementar `resolveMcpUrl()` em `apps/web/src/lib/mcpUrl.ts`, derivando `origem + basePath (__BASE_PATH__ sem barra final) + /mcp` e tolerando ausência de `window`; verificar com teste unitário cobrindo raiz, base path (`/azyboard/`) e ambiente sem `window` (`bun test apps/web/src/lib/mcpUrl.test.ts`).

## 2. Orientação de conexão na seção de API Keys

- [x] 2.1 Criar o componente de orientação (explicação curta + URL do MCP + botão copiar URL + botão copiar instrução, com confirmação visual e rótulos acessíveis) e renderizá-lo no topo de `ApiKeysSection.tsx`, reutilizando `copyTextToClipboard()` de `apps/web/src/lib/clipboard.ts` (sem reimplementar o fallback de clipboard); verificar com teste de componente (Testing Library) que a explicação e a URL aparecem, que copiar URL/instrução usa o helper com confirmação, que o retorno `false` do helper mantém o texto selecionável com mensagem e que nenhum valor de chave é exibido nessa orientação.
- [x] 2.2 Adicionar as novas chaves de tradução no namespace `settings` em pt-BR, en e es (explicação, rótulo/URL, copiar URL, copiar instrução, confirmações) usando interpolação `{{url}}`; verificar `bun run check:i18n`.
- [x] 2.3 Registrar em `DEPLOY.md` (seção "MCP remoto") que a URL do MCP também é exibida na página de conta com botão de copiar; verificar `bun run check:docs`.

## 3. Desenvolvimento local e verificação final

- [x] 3.1 Adicionar `/mcp` ao `server.proxy` do `apps/web/vite.config.ts`; verificar com o servidor de desenvolvimento (`bun run dev:web`) que `POST http://localhost:5173/mcp` sem credencial retorna `401` (proxy ativo) e que a URL exibida na conta aponta para `/mcp`.
- [x] 3.2 Verificação de integração: `bun run typecheck`, `bun run test:web`, `bun run check`, `bun run check:i18n`, `bun run check:docs` e `bun run check:frontend-tests` verdes; conferir manualmente em `/account` (raiz e sob base path simulado `__BASE_PATH__=/azyboard`) que a orientação aparece junto das demais seções, que a URL reflete o base path e que a cópia funciona por mouse e teclado.

## Workflow follow-up

- Arquivar a change após a revisão do projeto (e publicar a imagem web no ambiente desejado).
- Se um card do Azy Board for criado para este trabalho, registrar `Board ref: <itemId>` nos artefatos e encerrar o card em uma coluna com `baseStatus` DONE.
