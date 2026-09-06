## Why

O Azy Board já oferece um servidor MCP rico, com fluxos AI First, regras de hierarquia, permissões e auditoria, mas cada code agent precisa receber esse conhecimento de forma manual. Uma skill oficial e agnóstica de cliente reduz operações incorretas, torna a configuração reproduzível e permite que clientes compatíveis exponham comandos de operação do Azy Board.

## What Changes

- Criar uma pasta versionada para a skill oficial do Azy Board, com instruções operacionais focadas no uso do MCP.
- Documentar descoberta de projetos, leitura de contexto, planejamento, claim, execução, checklists, logs, encerramento e tratamento seguro de erros.
- Incluir instruções de instalação/configuração do MCP e arquivos de slash commands quando o cliente suportar esse mecanismo.
- Definir uma organização que possa ser consumida por Claude Code, OpenCode, Codex e outros clientes sem acoplamento a um único runtime.
- Registrar em `CONTRIBUTING.md` e nas guidelines do projeto que toda mudança deve avaliar impactos sobre a skill e atualizá-la quando contratos, ferramentas, fluxos ou comandos forem afetados.
- Adicionar validações/documentação para manter o conteúdo da skill alinhado ao catálogo MCP e aos contratos OpenSpec.

## Capabilities

### New Capabilities

- `official-agent-skill`: Skill oficial, distribuível e agnóstica de cliente para orientar code agents no uso do MCP e disponibilizar comandos do Azy Board.

### Modified Capabilities

Nenhuma. O servidor MCP e seus requisitos funcionais permanecem inalterados; a mudança cria uma camada de orientação e distribuição para clientes de agentes.

## Impact

- Novo diretório oficial de skill no repositório, incluindo instruções principais, referências de catálogo/configuração e comandos compatíveis.
- Atualização de `CONTRIBUTING.md` e possivelmente de `README.md`/documentação de integração para explicar instalação, manutenção e compatibilidade.
- Possível script de verificação que compare ferramentas/comandos documentados com o catálogo MCP, sem adicionar dependências de runtime ao servidor.
- Nenhuma alteração de endpoint REST, schema de dados, autenticação, autorização ou assinatura de ferramenta MCP.
