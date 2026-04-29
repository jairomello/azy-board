## Context

A tela de Settings do projeto (`SettingsPage.tsx`) já gerencia colunas, membros e squads. Módulos existem no banco e na API (GET/POST/PATCH) mas não têm UI nem endpoint DELETE. Versões não existem em lugar nenhum. Ambos os recursos são naturalmente gerenciados em Settings por serem configurações do projeto, não do board diário.

O campo `versionId` em items é transversal — afeta épicos, histórias, tasks, bugs e subtasks — e deve aparecer nas respectivas modais como campo opcional.

## Goals / Non-Goals

**Goals:**
- UI completa de módulos em Settings (lista, criar, renomear, excluir com tratamento de orphans)
- Endpoint DELETE de módulo na API
- CRUD de versões em Settings com campos: nome, data, descrição, situação
- Modal de detalhe de versão mostrando a lista de itens vinculados
- Campo `versionId` opcional em todos os tipos de item
- RBAC consistente (ADMIN para criar/editar/excluir módulos e versões; MEMBER pode associar versão a item)

**Non-Goals:**
- Reordenação drag-and-drop de módulos na tela de Settings (existe mas já está na API)
- Relatórios ou gráficos de progresso por versão
- Associação automática de versão baseada em sprint ou data

## Decisions

### Decisão 1: Tabela `project_versions` separada vs campo na tabela `projects`

**Escolhido: Tabela dedicada `project_versions`**

Um projeto terá múltiplas versões com ciclo de vida independente. Tabela separada permite FK em `items.version_id`, queries de "itens da versão" eficientes e histórico de versões sem comprometer a tabela de projetos.

**Schema:**
```
id           UUID PK
tenant_id    UUID NOT NULL  -- [TENANT]
project_id   UUID FK projects.id
name         TEXT NOT NULL
release_date TEXT (ISO date, nullable)
description  TEXT (nullable)
status       TEXT ENUM('PLANNED', 'IN_DEV', 'RELEASED', 'CANCELLED') DEFAULT 'PLANNED'
position     INTEGER DEFAULT 0
created_at   TEXT NOT NULL
```

### Decisão 2: `version_id` em `items` como FK nullable

**Escolhido: coluna nullable com FK para `project_versions`**

Campo opcional — a maioria dos itens existentes não terá versão associada. `ON DELETE SET NULL` garante que excluir uma versão não cascata nos itens.

### Decisão 3: Modal de detalhe de versão — nova modal vs página dedicada

**Escolhido: `VersionDetailModal`** — abre sobre Settings ao clicar em "Ver" ou "Editar" de uma versão.

Razão: mantém o contexto de Settings; não requer nova rota; padrão consistente com `ActivityLogModal`. A modal exibe o form de edição + lista de itens vinculados (título, tipo, status). Para "Ver", os campos são somente leitura.

### Decisão 4: Exclusão de módulo com épicos vinculados

**Escolhido: confirmação com seleção de módulo destino (ou exclusão dos épicos)**

O admin escolhe: mover épicos para outro módulo OU excluir tudo em cascata. Sem módulo destino disponível, só a opção de exclusão em cascata é oferecida. Essa lógica fica no frontend (modal de confirmação).

### Decisão 5: Situação (status) de versão

**Enum:** `PLANNED` (Planejada) | `IN_DEV` (Em desenvolvimento) | `RELEASED` (Lançada) | `CANCELLED` (Cancelada)

Badge colorido por status: cinza → azul → verde → vermelho.

## Risks / Trade-offs

- **Exclusão em cascata de módulo**: se o usuário confirmar excluir módulo com todos os épicos, remove toda uma árvore hierárquica — Mitigação: confirmação explícita com listagem do que será excluído.
- **Performance do GET itens de uma versão**: pode retornar muitos itens em projetos grandes — Mitigação: paginação (20/página) e filtro por tipo.
- **`ON DELETE SET NULL` em `items.version_id`**: garante integridade ao excluir versão sem perder os itens.

## Migration Plan

1. Migration: `CREATE TABLE project_versions` + `ALTER TABLE items ADD COLUMN version_id`
2. Deploy backend com novos endpoints
3. Deploy frontend com seções em Settings e campos nas modais
4. Rollback: `DROP TABLE project_versions` + `ALTER TABLE items DROP COLUMN version_id` (sem impacto em dados existentes)
