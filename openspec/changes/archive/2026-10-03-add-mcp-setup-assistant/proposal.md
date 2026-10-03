## Why

Configurar um cliente de code agent (Claude Code, Codex, OpenCode, outros) para falar MCP com o Azy Board hoje exige descobrir sozinho o transporte, o comando de inicialização, as variáveis de ambiente e o formato de configuração de cada cliente. A skill oficial já documenta a operação do board, mas não orienta o agente a **se autoconfigurar**; e o Azy Agent do chat interno não tem, no conhecimento curado, um roteiro para guiar o usuário nessa configuração. O resultado é atrito na adoção do MCP justamente para quem já tem a skill carregada.

## What Changes

- Adicionar à skill oficial um roteiro de **instalação/autoconfiguração do MCP** para o agente do usuário: pré-requisitos, emissão e uso seguro da API Key, arquivo/estrutura de configuração por cliente, verificação da conexão e problemas comuns.
- Expor esse roteiro como conteúdo da skill disponível por comando semântico e por linguagem natural, sem credenciais reais.
- Incluir o roteiro de configuração do MCP no **conhecimento curado do Azy Agent**, para que o chat interno saiba guiar o usuário (incluindo onde gerar a API Key e por que não colá-la em arquivo versionado), mantendo o guardrail de domínio.
- Manter as verificações automatizadas da skill e do pacote de conhecimento alinhadas ao novo conteúdo.

## Capabilities

### New Capabilities
- Nenhuma.

### Modified Capabilities
- `official-agent-skill`: novo requisito de autoconfiguração do MCP pelo agente do usuário (roteiro, verificação e segurança de credencial).
- `azy-agent-knowledge`: o pacote curado do Azy Agent passa a cobrir a configuração do MCP e o roteiro de onboarding do cliente.

## Impact

- `skills/azyboard/` (SKILL.md, novo comando e/ou referência de configuração) e espelhos (`.opencode/skills/azyboard`, `.agents/skills/azyboard`).
- `apps/api/src/services/assistantKnowledge.ts` (fontes curadas) e `scripts/build-azy-knowledge-pack.ts` (se a versão do pack mudar).
- `scripts/check-agent-skill.ts` e testes de contrato da skill; possivelmente `docs/azyboard-wiki/09 - Agentes e Integracoes/Configurar o Servidor MCP.md` como fonte citável.
- Sem mudança de API, schema ou contrato MCP; sem novas dependências.

Board ref: e6715818-aa9b-485d-bde1-c87c0eef68d7
