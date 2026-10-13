# Proposal

## Why

A seção de API Keys da página `/account` já mostra a URL do MCP e permite copiar uma instrução pronta para o code agent, mas nada **visível na tela** diz ao usuário que o próprio agente pode conduzir a configuração. Hoje esse caminho fácil (a skill oficial e o comando `/azyboard-setup-mcp`) só aparece depois que o usuário copia a instrução e a envia ao agente — quem não conhece a skill tende a montar a configuração à mão, com mais erro e atrito.

## What Changes

- Exibir, junto da orientação de conexão do MCP na seção de API Keys, uma **dica curta e visível** orientando o usuário a pedir ao seu code agent que use a skill oficial `azyboard` (comando `/azyboard-setup-mcp`) para conduzir a configuração do MCP.
- Manter a dica nos três idiomas (pt-BR, en, es) no namespace `settings`, sem pedir a chave no chat e sem exibir o valor da chave.

Sem **BREAKING**: é acréscimo de conteúdo textual na orientação existente; nenhuma rota, contrato ou permissão muda.

## Capabilities

### New Capabilities
<!-- Nenhuma capability nova: a dica pertence à orientação de conexão já especificada. -->

### Modified Capabilities
- `api-key-management`: novo requisito de dica visível apontando a skill oficial e o comando de configuração, ao lado da orientação de conexão do MCP.

## Impact

- Frontend: `apps/web/src/components/McpConnectionGuide.tsx` (parágrafo da dica) e o teste do componente.
- i18n: `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json` e o gate `check:i18n`.
- Sem mudanças de backend/API, sem migração e sem alteração no `DEPLOY.md` (a orientação documentada segue a mesma).
- Specs afetadas: `api-key-management`.
