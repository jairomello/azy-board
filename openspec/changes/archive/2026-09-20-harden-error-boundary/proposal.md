## Why

O `ErrorBoundary` em `apps/web/src/App.tsx` renderiza `error.message` e `error.stack` diretamente na tela. Em produção, qualquer erro de renderização expõe detalhes internos (caminhos de arquivo, versões de bibliotecas, nomes de módulos, formato de dados) para o usuário, sem oferecer um identificador para suporte. O card **Item 24** pede mensagem genérica em produção, correlation ID e stack restrito ao sistema de observabilidade.

## What Changes

- Extrair o boundary de `App.tsx` para um componente próprio `AppErrorBoundary` (testável e fora do shell de rotas).
- Em **produção**: exibir mensagem genérica traduzida e um **identificador de referência** (correlation ID) gerado por ocorrência; **nunca** renderizar `error.message` nem `error.stack`.
- Em **desenvolvimento**: manter a mensagem e o stack visíveis para depuração, junto do identificador de referência.
- Gerar o identificador por ocorrência e registrar o erro de forma estruturada (referência, mensagem, stack e `componentStack`) **apenas** no console/observabilidade — nunca na UI.
- Manter a ação de tentar novamente (reset do boundary) e adicionar semântica de acessibilidade (`role="alert"`).
- Traduzir os textos novos em pt-BR, en e es e remover o literal fixo "Tentar novamente" do `App.tsx`.
- Cobrir a regra com testes de unidade do utilitário de referência e um teste de contrato de que a UI não expõe stack em produção.

## Capabilities

### New Capabilities

- `frontend-error-boundary`: comportamento seguro do boundary de renderização do app, definindo o que é exibido em produção e em desenvolvimento, a geração do correlation ID, o registro em observabilidade e a acessibilidade da tela de erro.

### Modified Capabilities

- Nenhuma capability existente tem requisito funcional alterado; o contrato de erro do servidor permanece regido por `unified-error-contract`.

## Impact

- **Web:** `apps/web/src/App.tsx` (passa a usar o boundary extraído), novo `apps/web/src/components/AppErrorBoundary.tsx`, novo utilitário de referência em `apps/web/src/lib/`, `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json` e `apps/web/src/vite-env.d.ts` (tipos de `import.meta.env`).
- **Testes:** unidade do utilitário de referência e teste de contrato do boundary.
- **Rastreabilidade:** Board ref: `bf2af3ad-f9d8-496c-aafd-67d99327a47c` (Item 24).
- **Fora de escopo:** integração com Sentry/OpenTelemetry ou outro provedor de observabilidade, boundaries por rota/feature, captura global de `window.onerror`/`unhandledrejection` e o contrato de erro da API (já coberto por `unified-error-contract`).
