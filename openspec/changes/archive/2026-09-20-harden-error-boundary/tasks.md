## 1. Utilitário de erro e testes

- [x] 1.1 Registrar o `Board ref: bf2af3ad-f9d8-496c-aafd-67d99327a47c` (Item 24) no acompanhamento da change
- [x] 1.2 Criar `apps/web/src/lib/renderError.ts` com `createErrorReference()`, `shortErrorReference(reference)` e `describeRenderError(error, isProduction)`
- [x] 1.3 Implementar fallback de `createErrorReference()` para ambientes sem `crypto.randomUUID()`
- [x] 1.4 Adicionar teste de unidade cobrindo formato da referência, forma curta, fallback e decisão de detalhamento (produção x desenvolvimento)
- [x] 1.5 Adicionar a `reportRenderError({ reference, error, componentStack })` em `apps/web/src/lib/renderError.ts`, registrando o erro de forma estruturada

## 2. Componente do boundary

- [x] 2.1 Criar `apps/web/src/components/AppErrorBoundary.tsx` recebendo `isProduction?: boolean` com default `import.meta.env.PROD`
- [x] 2.2 Gerar a referência em `getDerivedStateFromError`, mantendo `{ error, reference }` no estado
- [x] 2.3 Em produção, renderizar apenas a mensagem genérica traduzida e a referência; nunca `error.message` nem `error.stack`
- [x] 2.4 Em desenvolvimento, exibir mensagem e stack para depuração, além da referência
- [x] 2.5 Registrar o erro via `reportRenderError` no `componentDidCatch`, com `componentStack`
- [x] 2.6 Adicionar `role="alert"` à tela de erro e manter a ação de recuperação que limpa o estado
- [x] 2.7 Renovar a referência quando um novo erro é capturado após a recuperação

## 3. Integração, tipos e i18n

- [x] 3.1 Substituir o `ErrorBoundary` inline de `apps/web/src/App.tsx` pelo `AppErrorBoundary` extraído
- [x] 3.2 Adicionar `apps/web/src/vite-env.d.ts` com referência aos tipos do Vite (`vite/client`)
- [x] 3.3 Adicionar as chaves da tela de erro (mensagem genérica, texto de apoio, rótulo da referência, recuperação) em `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json`
- [x] 3.4 Remover o literal fixo "Tentar novamente" do `App.tsx`, usando a chave traduzida

## 4. Testes e verificação

- [x] 4.1 Adicionar teste de contrato de que o boundary não renderiza `error.stack`/`error.message` em produção e usa `role="alert"`
- [x] 4.2 Garantir que o teste de contrato do dashboard (que lê `App.tsx`) continua válido após a extração
- [x] 4.3 Rodar `bun run check:i18n` e confirmar paridade das três locales
- [x] 4.4 Rodar `bun run check` (typecheck + lint + testes + build) e `bun run test:smoke`
- [x] 4.5 Validar o comportamento por testes de unidade (desenvolvimento expõe mensagem/stack; produção expõe apenas mensagem genérica + referência) — sem sessão de navegador nesta execução
- [x] 4.6 Rodar `openspec validate harden-error-boundary` e confirmar o fechamento do card Item 24 no board (`complete_task` + conferência via `get_board`/`list_tasks`)
