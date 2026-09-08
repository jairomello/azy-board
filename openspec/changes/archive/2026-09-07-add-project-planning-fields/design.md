## Context

O Azy Board permite criar e configurar projetos, mas atualmente não oferece campos para registrar o planejamento inicial (datas, estimativas de esforço e escopo). A tela de configurações (`SettingsPage.tsx`) já possui seções para Formato do board, Visibilidade, Colunas, Gerente, Membros & Squads, Centros de Custo, Módulos, Sprints e Versões. O schema Drizzle da tabela `projects` possui apenas campos básicos (nome, descrição, boardMode, visibilidade, gerente). O componente `RichTextEditor` (Tiptap) já é reutilizado em modais de items. As ferramentas MCP `create_project`, `create_project_structure` e `update_project` precisam expor os novos campos. O Azy Agent recebe contexto do projeto no prompt e deve ter acesso a esses dados.

## Goals / Non-Goals

**Goals:**
- Adicionar 5 campos opcionais ao modelo de projeto: `startDate`, `plannedEndDate`, `plannedPoints`, `plannedHours`, `scope`
- Criar seção "Planejamento" na tela de configurações do projeto com inputs adequados
- Reutilizar o `RichTextEditor` existente para o campo Escopo
- Expor os novos campos na API REST (GET e PATCH de projetos)
- Expor os novos campos nas ferramentas MCP de projeto
- Incluir os novos campos no contexto do projeto disponível ao Azy Agent
- Adicionar chaves i18n (PT-BR, EN, ES) para todos os novos labels

**Non-Goals:**
- Usar os campos para cálculos automáticos de velocity ou burn-down (futuro)
- Validar coerência entre datas e estimativas (ex.: data de fim antes do início)
- Exibir os campos de planejamento no card do projeto na listagem
- Criar dashboard de planejamento agregado multi-projeto

## Decisions

### 1. Modelagem dos campos no schema

**Decisão**: Adicionar 5 colunas nullable diretamente na tabela `projects`:
- `start_date` (text, ISO 8601 date string, nullable)
- `planned_end_date` (text, ISO 8601 date string, nullable)
- `planned_points` (integer, nullable)
- `planned_hours` (real, nullable)
- `scope` (text, HTML, nullable)

**Alternativa considerada**: Criar tabela separada `project_plans` com FK para `projects`. Rejeitada porque os campos são inerentemente atributos do projeto, não entidades independentes, e uma tabela separada adicionaria complexidade desnecessária de JOIN e manutenção.

**Racional**: Colunas nullable na tabela existente é o padrão usado por `manager_user_id` e `description`. Migration simples (ALTER TABLE ADD COLUMN). Zero impacto em queries existentes que não usam esses campos.

### 2. Tipo dos campos de data

**Decisão**: Armazenar como `text` (ISO 8601 `YYYY-MM-DD`), consistente com os campos `created_at`, `start_date` e `end_date` já usados na tabela `sprints`.

**Alternativa considerada**: Usar `integer` (timestamp Unix). Rejeitada porque o padrão do projeto é text ISO para datas.

### 3. Tipo do campo planned_hours

**Decisão**: Usar `real` para permitir valores fracionários (ex.: 2.5 horas).

**Racional**: Estimativas de horas frequentemente incluem frações. O campo `planned_points` usa `integer` porque story points são tipicamente inteiros.

### 4. Campo scope como HTML

**Decisão**: Armazenar como `text` contendo HTML (output do Tiptap), consistente com os campos `description`, `acceptance_criteria` e `notes` dos items.

**Racional**: O `RichTextEditor` já produz HTML. Reutiliza o mesmo padrão do sistema.

### 5. Posicionamento na SettingsPage

**Decisão**: Criar nova seção "Planejamento" logo após a seção "Visibilidade do projeto" e antes de "Colunas".

**Racional**: Campos de planejamento são informações de alto nível sobre o projeto, fazendo sentido aparecem cedo na página, antes das seções operacionais (colunas, membros, módulos).

### 6. Controles de input

**Decisão**:
- `startDate` e `plannedEndDate`: `<input type="date">` nativo (mesmo padrão usado em Sprints)
- `plannedPoints`: `<input type="number" min="0">` inteiro
- `plannedHours`: `<input type="number" min="0" step="0.5">` com casas decimais
- `scope`: Componente `RichTextEditor` reutilizado com `showExpand=true`

### 7. Estratégia de salvamento

**Decisão**: Usar `PATCH /projects/:id` com payload parcial, mesmo padrão já usado para `boardMode`, `managerUserId`, etc. Salvamento individual por campo (onBlur ou botão Salvar por seção).

**Alternativa considerada**: Formulário único com botão Salvar global. Rejeitada porque a página já usa o padrão de salvamento por seção (ex.: Colunas, Gerente, Módulos).

## Risks / Trade-offs

- **[Migration em produção com PostgreSQL]** → A migration usa ALTER TABLE ADD COLUMN com valores default NULL, que é uma operação online no PostgreSQL e SQLite. Sem risco de lock significativo.
- **[Campo scope pode crescer muito]** → HTML do Tiptap pode ser verboso. Como é um campo por projeto (não por card), o volume é baixo. Se necessário, pode-se limitar o tamanho no futuro.
- **[Datas sem validação de coerência]** → Nesta versão, não haverá validação cruzada entre `startDate` e `plannedEndDate`. O frontend pode exibir um aviso se a data de fim for anterior ao início, mas o backend aceita qualquer combinação. Mitigação: validação pode ser adicionada em iteração futura.
- **[MCP backward compatibility]** → Novos campos são todos opcionais nas ferramentas MCP. Agentes existentes que não os utilizam continuarão funcionando sem alteração.
