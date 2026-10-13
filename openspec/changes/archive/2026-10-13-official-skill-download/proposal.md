# Proposal

## Why

A orientação de conexão do MCP na seção de API Keys já explica a finalidade da chave, mostra a URL do MCP, oferece copiar a URL e copiar uma instrução para o code agent. Falta uma forma direta de obter a skill oficial: hoje o usuário precisa que o agente a instale sozinho ou copie os arquivos manualmente. Um botão de download da skill empacotada reduz atrito, entrega sempre a versão que acompanha a instalação e permite instalar a skill em clientes que não a baixam automaticamente.

## What Changes

- Adicionar, ao lado do botão "Copiar instrução para o agente" na seção de API Keys, um botão que baixa a skill oficial do Azy Board como um arquivo `.zip`.
- Empacotar a skill canônica `skills/azyboard/` (SKILL.md, commands, referências, scripts e manifest.json) em um `.zip` com a pasta raiz `azyboard/`.
- Expor um endpoint autenticado `GET /api/skills/azyboard/download` que responde o `.zip` com `Content-Type: application/zip` e `Content-Disposition: attachment; filename="azyboard-skill-<versão>.zip"`.
- Embarçar a skill na imagem de produção da API e resolver o diretório da skill por configuração (`AZYBOARD_SKILL_DIR`) com candidatos de fallback, no mesmo padrão de `resolveApiBuildInfo`.
- Usar a versão do `manifest.json` da skill como "versão mais recente" — a versão que acompanha a instalação (decisão confirmada: skill empacotada na instalação, não busca remota).
- Garantir que o `.zip` nunca contenha segredos e que o download exija sessão válida (decisão confirmada: endpoint autenticado da API).
- Não alterar os controles existentes de copiar URL e copiar instrução, nem a dica da skill.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `api-key-management`: adicionar o requisito do controle de download da skill oficial (`.zip`) na seção de API Keys, ao lado da cópia da instrução.
- `official-agent-skill`: adicionar o requisito de distribuição da skill como arquivo `.zip` versionado, servido pela instalação e derivado da skill canônica.

## Impact

- **API**: nova rota autenticada de download da skill e serviço de empacotamento `.zip` sem dependência nova em `apps/api/src`; montagem em `apps/api/src/index.ts`.
- **Empacotamento**: resolvedor do diretório da skill (env + candidatos) e geração de `.zip` em memória; alteração do `Dockerfile` para copiar `skills/azyboard` para a imagem e definir `AZYBOARD_SKILL_DIR`.
- **Frontend**: novo botão de download em `apps/web/src/components/McpConnectionGuide.tsx`, usando o padrão de download por `<a>` com `resolveAppUrl`.
- **i18n**: novas strings no namespace `settings` em pt-BR, en e es.
- **Testes**: verificação do `.zip` (entradas esperadas, raiz `azyboard/`, ausência de segredos) e teste de componente do botão.
- **Sem novas dependências**: o `.zip` é escrito com APIs nativas (`node:zlib`/`Bun.hash.crc32`), preservando a regra de licenças do projeto.
