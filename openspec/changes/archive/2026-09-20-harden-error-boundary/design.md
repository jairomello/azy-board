## Context

O único `ErrorBoundary` do app vive inline em `apps/web/src/App.tsx:10-43`, envolvendo as rotas. Ao capturar um erro, ele renderiza `error.message` e, quando presente, `error.stack` em um `<pre>`, além de registrar `console.error('[ErrorBoundary]', error, info)`. O app não possui utilitário de correlação/log estruturado, não usa `import.meta.env` em lugar algum e não há tipos de ambiente do Vite (`vite/client`) declarados. O contrato de erro do servidor é regido por `unified-error-contract`, que já proíbe stack trace no payload HTTP; falta o equivalente para erros de renderização no cliente.

Board ref: `bf2af3ad-f9d8-496c-aafd-67d99327a47c`.

## Goals / Non-Goals

**Goals:**

- Não expor mensagem, stack nem detalhes internos do erro na UI em produção.
- Oferecer um identificador de referência por ocorrência para correlação com suporte/observabilidade.
- Manter a depuração em desenvolvimento (mensagem + stack).
- Registrar o erro completo apenas em observabilidade/console, de forma estruturada.
- Cobrir a regra com testes determinísticos, sem depender de DOM/jsdom.
- Traduzir os textos e remover literais fixos.

**Non-Goals:**

- Integrar Sentry, OpenTelemetry ou outro provedor nesta entrega.
- Criar boundaries por rota/feature ou captura global de `window.onerror`/`unhandledrejection`.
- Alterar o contrato de erro da API (`unified-error-contract`).
- Redesenhar visualmente a tela de erro.

## Decisions

### 1. Extrair o boundary para `AppErrorBoundary.tsx`

Mover a classe de `App.tsx` para `apps/web/src/components/AppErrorBoundary.tsx`, mantendo `App.tsx` como composição. Facilita testar e evita que o shell de rotas acumule lógica de erro. Alternativa considerada: manter inline (rejeitada por dificultar teste e misturar responsabilidades).

### 2. Flag de produção injetável

O componente recebe `isProduction?: boolean`, com default `import.meta.env.PROD`. Isso permite exercitar os dois caminhos em teste sem bundler/DOM. Requer declarar tipos de ambiente (`vite-env.d.ts` com `/// <reference types="vite/client" />`), já que o projeto ainda não usa `import.meta.env`. Alternativa considerada: ler `import.meta.env.PROD` diretamente no render (rejeitada por não ser testável).

### 3. Utilitário puro de referência

Criar `apps/web/src/lib/renderError.ts` com funções puras:

- `createErrorReference()` — usa `crypto.randomUUID()` com fallback determinístico quando indisponível;
- `shortErrorReference(reference)` — forma curta exibida (ex.: 8 caracteres em maiúsculas);
- `describeRenderError(error, isProduction)` — decide o que a UI pode mostrar.

Mantém a regra testável em unidade, sem depender do React. Alternativa considerada: gerar o id direto no componente (rejeitada por dificultar teste).

### 4. Referência no estado do boundary

Gerar o identificador em `getDerivedStateFromError`, guardando `{ error, reference }`, para que ele exista já no primeiro render da tela de erro. `componentDidCatch` apenas registra o erro com a referência. Alternativa considerada: gerar em `componentDidCatch` (rejeitada: o primeiro render ficaria sem referência).

### 5. Observabilidade como função dedicada

`reportRenderError({ reference, error, componentStack })` concentra o `console.error` estruturado e serve de ponto único para plugar um provedor no futuro. A stack e a mensagem originais ficam restritas a esse caminho. Alternativa considerada: logar direto no `componentDidCatch` (rejeitada por espalhar a política de log).

### 6. i18n e acessibilidade

Novas chaves em `common.json` (mensagem genérica, texto de apoio, rótulo da referência, ação de recuperação) nos três idiomas; remover o literal "Tentar novamente" do `App.tsx`. O contêiner da tela usa `role="alert"` e o botão mantém o foco por teclado. Alternativa considerada: reaproveitar apenas `renderError` (rejeitada: não cobre mensagem genérica nem referência).

## Risks / Trade-offs

- **Vazamento por `error.message` em produção** → a UI de produção usa apenas a mensagem genérica e a referência; `describeRenderError` centraliza a decisão.
- **`crypto.randomUUID` indisponível (contexto não seguro)** → fallback baseado em tempo/aleatório no utilitário, com teste do fallback.
- **Sem jsdom/RTL, testes de UI são limitados** → cobrir a lógica com funções puras e um teste de contrato que verifica que o componente não renderiza stack em produção.
- **Boundary único no topo derruba a rota inteira ao falhar** → comportamento atual mantido; o usuário pode tentar novamente. Boundaries por rota ficam como evolução.
- **Referência não rastreável sem backend de logs** → o id é logado de forma estruturada e exibido; a integração com provedor é evolução futura.

## Migration Plan

1. Criar `renderError.ts` e seus testes de unidade.
2. Criar `AppErrorBoundary.tsx` com a flag `isProduction` e `role="alert"`.
3. Substituir o boundary inline em `App.tsx` pelo componente extraído.
4. Adicionar `vite-env.d.ts` e as chaves de i18n nos três idiomas.
5. Adicionar teste de contrato do boundary e rodar `bun run check` e `bun run check:i18n`.
6. Rollback: reverter os arquivos do frontend; nenhuma migração de banco ou contrato de API é afetada.

## Open Questions

- Adotar um provedor de observabilidade (Sentry/OpenTelemetry) agora? Recomendação: não nesta entrega; deixar o ponto de extensão pronto.
- Boundaries por rota para isolar falhas de uma página? Recomendação: avaliar em card próprio, mantendo o boundary global.
