## ADDED Requirements

### Requirement: Seção "Planejamento" na tela de Settings do projeto
O sistema SHALL exibir uma seção "Planejamento" na página de configurações do projeto (`SettingsPage`), posicionada após a seção "Visibilidade do projeto" e antes da seção "Colunas". A seção SHALL conter os campos: Data de Início, Data de Fim Previsto, Total de Pontos Previsto, Total de Horas Previsto e Escopo. Nenhum dos campos é obrigatório.

#### Scenario: Admin acessa a seção Planejamento
- **WHEN** administrador navega para Settings do projeto
- **THEN** seção "Planejamento" é exibida com os 5 campos vazios (nenhum preenchido por padrão)

#### Scenario: Admin preenche datas previstas
- **WHEN** administrador informa `startDate` e/ou `plannedEndDate` e salva
- **THEN** sistema persiste as datas em formato ISO 8601 (YYYY-MM-DD) e exibe os valores preenchidos

#### Scenario: Admin preenche estimativas numéricas
- **WHEN** administrador informa `plannedPoints` (inteiro ≥ 0) e/ou `plannedHours` (real ≥ 0, step 0.5)
- **THEN** sistema persiste os valores e os exibe formatados na seção

#### Scenario: Admin preenche escopo com texto rico
- **WHEN** administrador digita texto formatado no campo Escopo usando a toolbar do editor rico
- **THEN** sistema persiste o conteúdo como HTML e o reexibe com formatação preservada

#### Scenario: Admin expande o campo Escopo
- **WHEN** administrador clica no botão de maximizar do campo Escopo
- **THEN** sistema abre visualização ampliada do editor rico em modal fullscreen, permitindo edição confortável de textos longos

#### Scenario: Campos vazios são persistidos como null
- **WHEN** administrador salva a seção sem preencher nenhum campo
- **THEN** sistema persiste todos os campos como `null` e a seção permanece vazia

#### Scenario: VIEWER vê planejamento em modo leitura
- **WHEN** usuário com papel VIEWER acessa Settings do projeto
- **THEN** seção "Planejamento" exibe os valores preenchidos em modo somente leitura, sem controles de edição

#### Scenario: MEMBER vê planejamento em modo leitura
- **WHEN** usuário com papel MEMBER acessa Settings do projeto
- **THEN** seção "Planejamento" exibe os valores preenchidos em modo somente leitura, sem controles de edição

---

### Requirement: Campos de planejamento no modelo de dados do projeto
O sistema SHALL armazenar os campos de planejamento diretamente na tabela `projects` como colunas nullable: `start_date` (text, ISO 8601), `planned_end_date` (text, ISO 8601), `planned_points` (integer), `planned_hours` (real) e `scope` (text, HTML).

#### Scenario: Migration adiciona colunas sem perda de dados
- **WHEN** migration é executada em banco existente
- **THEN** as 5 novas colunas são adicionadas com valor `null` para todos os projetos existentes, sem perda de dados

#### Scenario: Campos são opcionais na criação
- **WHEN** projeto é criado sem informar campos de planejamento
- **THEN** projeto é criado normalmente com todos os campos de planejamento como `null`

---

### Requirement: API REST expõe campos de planejamento
O sistema SHALL aceitar e retornar os campos de planejamento nas rotas de projeto. `GET /projects/:id` SHALL retornar os 5 campos. `PATCH /projects/:id` SHALL aceitar atualização parcial dos 5 campos. `POST /projects` SHALL aceitar os 5 campos como opcionais no payload de criação.

#### Scenario: GET retorna campos de planejamento
- **WHEN** cliente autenticado requisita `GET /projects/:id`
- **THEN** resposta inclui `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours` e `scope` (null quando não preenchidos)

#### Scenario: PATCH atualiza campos de planejamento
- **WHEN** admin envia `PATCH /projects/:id` com `{ startDate: "2026-01-15", plannedPoints: 100 }`
- **THEN** sistema persiste apenas os campos enviados e retorna o projeto atualizado

#### Scenario: POST cria projeto com planejamento
- **WHEN** cliente envia `POST /projects` com campos de planejamento no payload
- **THEN** sistema cria o projeto com os valores informados

#### Scenario: PATCH rejeita valores inválidos
- **WHEN** admin envia `PATCH /projects/:id` com `plannedPoints: -5`
- **THEN** sistema retorna erro 422 com mensagem de validação

---

### Requirement: Internacionalização dos campos de planejamento
O sistema SHALL fornecer traduções em PT-BR, EN e ES para todos os labels, placeholders e mensagens de validação dos campos de planejamento.

#### Scenario: Labels em português
- **WHEN** idioma ativo é PT-BR
- **THEN** seção exibe: "Data de Início", "Data de Fim Previsto", "Total de Pontos Previsto", "Total de Horas Previsto", "Escopo"

#### Scenario: Labels em inglês
- **WHEN** idioma ativo é EN
- **THEN** seção exibe: "Start Date", "Planned End Date", "Planned Total Points", "Planned Total Hours", "Scope"

#### Scenario: Labels em espanhol
- **WHEN** idioma ativo é ES
- **THEN** seção exibe: "Fecha de Inicio", "Fecha de Fin Prevista", "Total de Puntos Previsto", "Total de Horas Previsto", "Alcance"
