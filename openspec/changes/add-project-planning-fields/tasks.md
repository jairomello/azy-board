## 1. Schema e Migration

- [x] 1.1 Adicionar 5 colunas nullable na tabela `projects` em `apps/api/src/db/schema.ts`: `startDate` (text), `plannedEndDate` (text), `plannedPoints` (integer), `plannedHours` (real), `scope` (text)
- [x] 1.2 Criar migration SQL adicionando as colunas com ALTER TABLE ADD COLUMN (sem default, nullable)
- [x] 1.3 Atualizar tipos TypeScript derivados do schema (select/insert types) se existirem tipos explícitos

## 2. API REST

- [x] 2.1 Atualizar `GET /projects/:id` em `apps/api/src/routes/projects.ts` para retornar os 5 novos campos na resposta
- [x] 2.2 Atualizar `PATCH /projects/:id` para aceitar e persistir os 5 campos opcionais com validação (plannedPoints ≥ 0, plannedHours ≥ 0, datas em formato ISO 8601)
- [x] 2.3 Atualizar `POST /projects` para aceitar os 5 campos opcionais no payload de criação
- [x] 2.4 Atualizar `GET /projects` (listagem) para retornar os 5 campos na resposta de cada projeto

## 3. Frontend — Seção Planejamento na SettingsPage

- [x] 3.1 Criar nova seção "Planejamento" em `apps/web/src/pages/SettingsPage.tsx`, posicionada após "Visibilidade do projeto" e antes de "Colunas"
- [x] 3.2 Adicionar inputs de data (`<input type="date">`) para `startDate` e `plannedEndDate`
- [x] 3.3 Adicionar input numérico inteiro (`<input type="number" min="0">`) para `plannedPoints`
- [x] 3.4 Adicionar input numérico decimal (`<input type="number" min="0" step="0.5">`) para `plannedHours`
- [x] 3.5 Adicionar campo Escopo reutilizando o componente `RichTextEditor` com `showExpand={true}`
- [x] 3.6 Implementar salvamento via `PATCH /projects/:id` com payload parcial (padrão existente por seção)
- [x] 3.7 Implementar modo leitura para VIEWER e MEMBER (campos desabilitados, sem botão salvar)
- [x] 3.8 Carregar os valores existentes do projeto ao abrir a página (populando os campos a partir do `GET /projects/:id`)

## 4. Internacionalização (i18n)

- [x] 4.1 Adicionar chaves PT-BR em `apps/web/src/i18n/locales/pt-BR/settings.json`: labels "Data de Início", "Data de Fim Previsto", "Total de Pontos Previsto", "Total de Horas Previsto", "Escopo", "Planejamento" e placeholders
- [x] 4.2 Adicionar chaves EN em `apps/web/src/i18n/locales/en/settings.json`: "Start Date", "Planned End Date", "Planned Total Points", "Planned Total Hours", "Scope", "Planning"
- [x] 4.3 Adicionar chaves ES em `apps/web/src/i18n/locales/es/settings.json`: "Fecha de Inicio", "Fecha de Fin Prevista", "Total de Puntos Previsto", "Total de Horas Previsto", "Alcance", "Planificación"

## 5. MCP — Ferramentas de Projeto

- [x] 5.1 Atualizar schema de `create_project` em `apps/mcp/src/` para aceitar `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours`, `scope` como parâmetros opcionais
- [x] 5.2 Atualizar schema de `create_project_structure` para aceitar os mesmos 5 campos opcionais
- [x] 5.3 Atualizar schema de `update_project` para aceitar os 5 campos opcionais
- [x] 5.4 Atualizar execução de `get_project` para retornar os 5 campos na resposta
- [x] 5.5 Atualizar `registry.ts` para passar os novos campos ao executar as ferramentas

## 6. Azy Agent — Contexto do Projeto

- [x] 6.1 Atualizar resolução de projeto em `apps/api/src/routes/assistant.ts` para incluir os 5 campos de planejamento no objeto `selectedProject`
- [x] 6.2 Atualizar `formatAssistantPromptContext()` para injetar os dados de planejamento no system prompt do agente quando preenchidos
- [x] 6.3 Atualizar endpoint `GET /projects/:id/board` para incluir os campos de planejamento no contexto retornado

## 7. Testes

- [x] 7.1 Adicionar testes de API para `PATCH /projects/:id` com campos de planejamento (válidos e inválidos)
- [x] 7.2 Adicionar testes de API para `POST /projects` com campos de planejamento
- [x] 7.3 Adicionar testes de API para `GET /projects/:id` verificando retorno dos novos campos
- [x] 7.4 Atualizar suíte de regressão MCP para testar `create_project` e `update_project` com campos de planejamento
- [ ] 7.5 Testar manualmente a UI: preencher campos, salvar, recarregar página, verificar persistência e modo leitura
