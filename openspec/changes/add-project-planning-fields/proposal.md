## Why

Atualmente o cadastro de projetos do Azy Board não permite registrar informações de planejamento inicial (datas previstas, estimativas de esforço e escopo). Equipes precisam manter esses dados em ferramentas externas ou documentos paralelos, perdendo a visão consolidada do projeto. Adicionar esses campos na configuração do projeto permite que gestores registrem e consultem o planejamento diretamente na plataforma, e que agentes de IA (via MCP e Azy Agent) possam usar esses dados como contexto para decisões e relatórios.

## What Changes

- Adicionar 5 novos campos opcionais na tabela `projects`: `start_date`, `planned_end_date`, `planned_points`, `planned_hours` e `scope` (texto rico em HTML).
- Criar nova seção "Planejamento" na tela de configurações do projeto (`SettingsPage`), exibindo os 5 campos com seus respectivos controles de input (date pickers, number inputs e editor rico).
- O campo "Escopo" reutilizará o componente `RichTextEditor` existente (Tiptap), com suporte a formatação markdown e visualização ampliada.
- Nenhum dos campos é obrigatório.
- Atualizar a API REST (`PATCH /projects/:id` e `GET /projects/:id`) para aceitar e retornar os novos campos.
- Atualizar as ferramentas MCP `create_project`, `create_project_structure` e `update_project` para expor os novos campos.
- Garantir que o Azy Agent receba os novos campos no contexto do projeto para uso em conversas e automações.

## Capabilities

### New Capabilities
- `project-planning-fields`: Campos de planejamento do projeto (datas previstas, estimativas de pontos/horas e escopo rico) na configuração do projeto, incluindo UI, API, MCP e contexto do agente.

### Modified Capabilities
- `project-management`: Adição dos novos campos opcionais ao modelo de projeto e à tela de configurações.
- `mcp-server`: Novos campos expostos nas ferramentas `create_project`, `create_project_structure` e `update_project`.
- `azy-agent-chat`: Contexto do projeto enriquecido com dados de planejamento para uso pelo agente.

## Impact

- **Schema/DB**: Nova migration adicionando 5 colunas nullable à tabela `projects`.
- **API (Hono)**: Rotas de projeto em `apps/api/src/routes/projects.ts` — validar e persistir novos campos.
- **Frontend**: `SettingsPage.tsx` — nova seção "Planejamento" com date pickers, number inputs e `RichTextEditor`.
- **MCP**: `apps/mcp/src/tools.ts` e `registry.ts` — novos parâmetros nas ferramentas de projeto.
- **Agente**: `apps/api/src/routes/assistant.ts` — incluir novos campos no contexto do projeto injetado no prompt.
- **i18n**: Novas chaves de tradução para labels e placeholders dos 5 campos.
- **Testes**: Cobertura para API, MCP e UI.
