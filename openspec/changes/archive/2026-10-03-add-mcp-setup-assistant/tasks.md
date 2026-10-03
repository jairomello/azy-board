## 1. Skill: roteiro de configuração do MCP

- [x] 1.1 Criar `skills/azyboard/references/mcp-setup.md` com pré-requisitos, geração da API Key, estrutura de configuração do servidor `azy-board` por cliente, verificação da conexão, `projectId`/`AZYBOARD_PROJECT_ID` e problemas comuns (usando placeholders, sem segredos).
- [x] 1.2 Adicionar o comando semântico de configuração (`skills/azyboard/commands/setup-mcp.md`) e registrá-lo em `manifest.json` e no README de comandos.
- [x] 1.3 Referenciar o novo roteiro no `SKILL.md` e reforçar a segurança de credencial (ambiente/cofre, nunca versionado).
- [x] 1.4 Espelhar as alterações em `.opencode/skills/azyboard/` e `.agents/skills/azyboard/` conforme a convenção de paths.

## 2. Azy Agent: conhecimento curado

- [x] 2.1 Adicionar ao `assistantKnowledge.ts` uma fonte `mcp-setup` apontando para a documentação de configuração do MCP, com conteúdo curto e citável.
- [x] 2.2 Atualizar `KNOWLEDGE_PACK_VERSION` e regenerar/validar a lista de fontes curadas.
- [x] 2.3 Confirmar que o guardrail (não executar shell/editar arquivos do cliente) permanece e que a recuperação por termos de configuração retorna a nova fonte.

## 3. Verificação automatizada

- [x] 3.1 Estender `scripts/check-agent-skill.ts` (ou o teste correspondente) para exigir a presença do roteiro/comando de configuração do MCP e a ausência de segredos.
- [x] 3.2 Testes: `bun run test:agent-skill`, `bun run check:docs` e um teste do knowledge pack cobrindo a nova fonte.

## 4. Verificação final

- [x] 4.1 Rodar `bun run check`, `bun run test:smoke` e `bun run test:agent-skill`, corrigindo eventuais falhas.

Board ref: e6715818-aa9b-485d-bde1-c87c0eef68d7
