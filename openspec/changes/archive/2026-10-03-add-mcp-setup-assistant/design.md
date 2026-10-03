## Context

O Azy Board já mantém uma skill oficial e agnóstica de cliente (`skills/azyboard/`) com playbooks, regras e comandos semânticos, e um pacote de conhecimento curado consumido pelo Azy Agent (`apps/api/src/services/assistantKnowledge.ts`). A documentação de instalação do MCP existe na wiki (`docs/azyboard-wiki/09 - Agentes e Integracoes/Configurar o Servidor MCP.md`), mas nenhuma dessas superfícies instrui o próprio agente a **se autoconfigurar** a partir de um pedido em linguagem natural.

Fatos relevantes do ambiente:
- O servidor MCP é stdio e lê `EASYBOARD_API_KEY`, `EASYBOARD_URL` e `AZYBOARD_PROJECT_ID`.
- A API Key é emitida na interface em **Minha conta → Gerenciar API Keys**; a config atual já tem um exemplo real em `opencode.json`, que é **gitignored** (o segredo não deve ir para arquivo versionado).
- Cada cliente (Claude Code, Codex, OpenCode) usa um formato de configuração diferente para registrar um servidor MCP.
- O pacote curado do agente é pequeno e versionado, com fontes declaradas e verificáveis.

## Goals / Non-Goals

**Goals:**
- Um agente com a skill carregada consegue guiar/executar a configuração do MCP no cliente do usuário, sem depender de conhecimento externo.
- O Azy Agent do chat interno responde sobre configuração do MCP citando a fonte curada, mantendo o guardrail de domínio.
- Nenhum segredo real entra em artefato versionado; a skill usa placeholders.
- As verificações existentes (`check-agent-skill`, conhecimento curado) continuam verdes e passam a cobrir o novo conteúdo.

**Non-Goals:**
- Emitir API Key automaticamente por endpoint/CLI (o card não pede; permanece o fluxo manual em Minha conta).
- Suportar configuração de clientes além do formato documentado (a skill orienta o agente a adaptar, mas não versiona configs específicas de terceiros).
- Alterar o protocolo MCP, o catálogo de ferramentas ou a API REST.

## Decisions

- **Roteiro de configuração como referência da skill + comando semântico:** criar `references/mcp-setup.md` com o passo a passo (pré-requisitos, gerar a API Key, montar a config por cliente, verificar, problemas comuns) e um comando `setup-mcp` em `commands/`, para disparo por slash command ou linguagem natural. Alternativa considerada: inchar o `SKILL.md`; preterida, pois a skill já é orientada a referências e o roteiro é opcional.
- **Reuso da wiki como fonte canônica do agente:** em vez de duplicar o texto de configuração, o knowledge pack passa a citar `Configurar o Servidor MCP.md` (fonte citável e já mantida), garantindo consistência entre o que a skill diz e o que o agente responde.
- **Placeholders sempre:** a skill e o agente usam `azb_sua_chave_aqui`; a orientação reforça que a chave vai no ambiente/cofre do cliente, nunca em arquivo versionado, e que cada cliente/ambiente usa uma chave própria.
- **Adaptação por cliente, sem versionar terceiros:** a skill descreve a estrutura (servidor `azy-board`, comando `bun run .../apps/mcp/src/index.ts`, env `EASYBOARD_API_KEY`/`EASYBOARD_URL`/`AZYBOARD_PROJECT_ID`) e instrui o agente a localizar o arquivo de config do cliente, em vez de manter exemplos de cada ferramenta.
- **Descoberta do projectId como passo opcional:** orientar a colocar `AZYBOARD_PROJECT_ID` quando o repositório trabalha com um único projeto, reforçando que o ID não é segredo (pode ser versionado) mas a chave não.

## Risks / Trade-offs

- [Instruções de configuração ficarem desatualizadas por mudança de cliente] → o roteiro descreve estrutura e princípios, não versões de arquivo; a verificação da skill cobre a presença dos elementos obrigatórios.
- [Usuário colar a chave em arquivo versionado] → orientação explícita em skill, agente e comando sobre ambiente/cofre, com o exemplo de `.gitignore`; a wiki reforça.
- [O agente do chat tentar "executar" configuração] → guardrail de domínio: o Azy Agent orienta e explica; não executa shell nem edita arquivos do cliente.
- [Fonte curada citar caminho que muda] → o pacote versiona `sha256` e caminho; a alteração de fonte exige atualizar a versão do pack e os testes.

## Migration Plan

Mudança aditiva de documentação/knowledge: atualizar skill e seus espelhos, adicionar a fonte curada e regenerar/atualizar a versão do pack. Sem migração de dados nem rollout especial; rollback é reverter os arquivos.

## Open Questions

Nenhuma pendente. Confirmado: escopo é skill + Azy Agent (partes 1 e 2 do card); emissão de chave permanece manual na interface.
