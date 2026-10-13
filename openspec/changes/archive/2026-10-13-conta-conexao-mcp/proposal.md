# Proposal

## Why

Hoje a seção de API Keys da página de conta não deixa claro que a chave serve para conectar o **code agent do usuário ao MCP do Azy Board**, nem mostra o **endpoint MCP** da instalação. O usuário precisa descobrir a URL e o procedimento por conta própria, o que gera erro (chave usada no lugar errado, URL inventada) e atrito para conectar Claude Code, Codex ou OpenCode.

## What Changes

- Adicionar, na seção de API Keys da página `/account`, uma orientação que explique em uma frase que a chave conecta o code agent do usuário ao MCP do Azy Board.
- Exibir ali a **URL do MCP** da instalação (derivada da origem atual + base path + `/mcp`) e um **botão de copiar** com feedback visual.
- Oferecer um atalho para copiar também uma **instrução pronta** (texto curto com a URL) que o usuário envia ao seu agente para ele conectar usando a skill oficial `azyboard`.
- Manter os textos novos nos três idiomas (pt-BR, en, es) no namespace `settings`, acessíveis por teclado, sem exibir o valor da chave.
- Incluir `/mcp` no proxy do servidor de desenvolvimento (Vite), para que a URL exibida funcione também em desenvolvimento.

Sem **BREAKING**: é um acréscimo de conteúdo/controle na UI; nenhuma rota, contrato ou permissão existente muda.

## Capabilities

### New Capabilities
<!-- Nenhuma capability nova: o comportamento pertence a capacidades existentes. -->

### Modified Capabilities
- `api-key-management`: novo requisito de orientação de conexão do MCP na seção de API Keys (explicação, URL do MCP, cópia da URL, cópia de instrução, i18n e acessibilidade), sem alterar os requisitos existentes de listar/gerar/revogar.
- `account-settings`: a página `/account` passa a declarar que a seção de API Keys inclui a orientação de conexão do MCP do Azy Board.

## Impact

- Frontend: `apps/web/src/components/ApiKeysSection.tsx`, `apps/web/src/lib/` (novo resolvedor da URL do MCP; reuso de `apps/web/src/lib/clipboard.ts` para a cópia com fallback), `apps/web/vite.config.ts` (proxy `/mcp`).
- i18n: `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`.
- Testes de frontend do componente/helper e o gate `check:i18n`.
- Sem mudanças de backend/API e sem migração: a URL do MCP é derivada no cliente de `window.location.origin` + `window.__BASE_PATH__`.
- Specs afetadas: `api-key-management`, `account-settings`.
