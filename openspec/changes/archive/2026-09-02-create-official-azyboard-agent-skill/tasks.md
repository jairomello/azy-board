## 1. Estrutura Canônica

- [x] 1.1 Criar `skills/azyboard/` com `SKILL.md`, manifesto/versionamento e convenções de distribuição agnósticas de cliente.
- [x] 1.2 Escrever referências da skill a partir de `apps/mcp/README.md`, `apps/mcp/src/index.ts`, políticas MCP e documentação AI First, sem duplicar conteúdo desnecessário da wiki.
- [x] 1.3 Documentar configuração segura do servidor MCP, variáveis de ambiente, descoberta de `projectId`, permissões herdadas e limites da integração.

## 2. Playbooks E Comandos

- [x] 2.1 Documentar os playbooks de bootstrap, leitura de contexto, planejamento, execução, revisão e encerramento.
- [x] 2.2 Documentar decisões de hierarquia, Leaf Rule, projetos SIMPLE, claim, checklist/subtask, logs, paginação, idempotência e erros retryable/conflict.
- [x] 2.3 Criar comandos semânticos para status/contexto, planejar trabalho, iniciar/claim, atualizar progresso, concluir e revisar, com pré-condições e confirmação para ações destrutivas.
- [x] 2.4 Adicionar adaptadores ou instruções de instalação dos comandos para Claude Code, OpenCode e Codex, mantendo fallback por linguagem natural para clientes sem slash commands.

## 3. Guidelines E Distribuição

- [x] 3.1 Atualizar `CONTRIBUTING.md` com o gate obrigatório de avaliação de impacto da skill em toda mudança e com critérios para atualizar referências, comandos e manifesto.
- [x] 3.2 Atualizar `README.md` e a documentação de integração MCP com a localização oficial da skill e instruções de instalação/distribuição sem credenciais versionadas.
- [x] 3.3 Definir no manifesto a fonte do catálogo MCP e o procedimento para manter a skill sincronizada com ferramentas, schemas e contratos OpenSpec.

## 4. Verificação E Testes

- [x] 4.1 Implementar verificador local do catálogo da skill contra o catálogo/políticas MCP, cobrindo ferramentas obrigatórias, referências e comandos, sem API ou banco externo.
- [x] 4.2 Adicionar testes para divergência de ferramenta, comando ausente, referência inválida e presença de padrões proibidos de segredo.
- [x] 4.3 Executar `bun run test:mcp-catalog`, o verificador da skill, `bun run typecheck` e `bun test`, corrigindo regressões documentais ou de integração.
- [x] 4.4 Revisar os arquivos finais contra `official-agent-skill` e confirmar que a skill não altera contratos REST/MCP nem inclui credenciais reais.
