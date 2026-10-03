## Context

O Azy Board não possui hoje nenhum campo visual configurável em `projects` nem em `items`; a única cor de entidade é `tags.color` (string hex, default `#6366f1`). O frontend já usa `lucide-react` (licença ISC) em 44 arquivos, com um mapa estático de ícones por tipo de item em `apps/web/src/lib/itemTypeMeta.ts`. Não há shadcn/Radix em uso para Popover/Command/Tabs; o único seletor de cor existente é o `TagSelector`, com uma paleta fixa `TAG_COLORS` de 10 hex e dropdown custom via portal.

Restrições relevantes: schemas Zod `.strict()` na API; o PATCH de item filtra por `writableFields`; há dois schemas Drizzle independentes (SQLite e PostgreSQL) com migrações manuais e listas de migrações PG fixadas em testes; o web tem orçamento de bundle (`check:bundle`) e guardas estruturais (`check:frontend-tests`, contratos que leem código-fonte), além de i18n obrigatório em PT-BR/EN/ES.

Board ref: `12b44609-2002-413c-b8a3-a2db35bf9cd8` (card T14).

## Goals / Non-Goals

**Goals:**
- Definir um catálogo curado de ícones open-source reutilizável por web, API e MCP.
- Persistir `icon` e `color` opcionais e nullable em projetos e itens, com ícone default quando ausente.
- Permitir escolher ícone e cor de projeto e de item na UI, e exibir esses valores de forma consistente (sidebar, header, breadcrumb, lista de projetos, card e modal).
- Validar os campos no backend e propagá-los por API, projeção do board e tools MCP.
- Manter licenciamento permissivo e o orçamento de bundle sob controle.

**Non-Goals:**
- Upload de ícone/imagem customizado ou favicon de projeto.
- Ícones/cores por coluna, módulo, sprint, versão ou squad.
- Alterar a paleta do tema ou permitir color picker livre fora da paleta.
- Animações ou ícones dinâmicos carregados em runtime a partir de um CDN.

## Decisions

### 1. Pacote de ícones: lucide-react (ISC), com catálogo curado
Manter `lucide-react` (já dependência, licença ISC) como pacote oficial e expor um catálogo curado de nomes em kebab-case. Alternativas descartadas: `react-icons` (MIT, mas agrega muitas famílias e infla o bundle) e `@tabler/icons-react` (MIT, porém ~5k ícones pesa). Um catálogo curado resolve a demanda sem nova dependência e sem risco de licença.

### 2. Contrato do catálogo em `packages/ui-contracts`
Adicionar em `packages/ui-contracts` (já dependência de API, web e MCP): `ICON_CATALOG` (array readonly de nomes), `IconName`, `DEFAULT_PROJECT_ICON`, `DEFAULT_ITEM_ICON` e `ICON_COLORS` (paleta fixa reutilizando os 10 hex de `TAG_COLORS`). O mapa nome→componente `LucideIcon` vive somente no web (`apps/web/src/lib/iconCatalog.ts`), pois o backend não deve importar React. Alternativa descartada: criar um pacote novo `@azy-board/icon-catalog` (desnecessário) e permitir nome de ícone livre (sem validação e com risco de nomes inexistentes).

### 3. Persistência em colunas dedicadas
Adicionar `icon` (text nullable) e `color` (text nullable) em `projects` e `items`, seguindo o precedente de `tags.color`. Alternativa descartada: um campo JSON `appearance` (dificulta validação, projeção, filtros e migração).

### 4. Default não persistido, aplicado na apresentação
A API persiste `null` quando não personalizado e devolve `null`; web e agentes aplicam `DEFAULT_PROJECT_ICON`/`DEFAULT_ITEM_ICON` e a cor padrão do tema (`currentColor`) na renderização. Isso mantém os dados limpos e permite trocar o default sem migração. Alternativa descartada: gravar o default na criação (impede distinguir “não escolhido” de “escolhido” e engessa o default).

### 5. Validação server-side
`icon` validado por pertencimento a `ICON_CATALOG`; `color` validado por `z.enum(ICON_COLORS)`. Ambos opcionais, aceitam `null` (limpar) e são adicionados aos schemas `.strict()`, ao `writableFields` do PATCH de item e aos campos de projeção MCP. Cor livre é rejeitada para garantir consistência visual.

### 6. Migrações aditivas nos dois dialetos
`ALTER TABLE ... ADD COLUMN` em migração SQLite (`apps/api/src/db/migrations/0038_*.sql`) e migração PG equivalente em `apps/api/src/db/postgres/migrations/0009_*.sql`, sem backfill. Atualizar as listas de migrações fixadas em `migrations.test.ts` e `parity.test.ts`. Sem bump de `INSTALLATION_SCHEMA_REVISION` (mudança aditiva).

### 7. UI de seleção no padrão existente
Criar um `IconPicker` (grade com busca simples) e reaproveitar a paleta como swatches de cor, no mesmo padrão do `TagSelector` (dropdown custom com portal, sem adicionar Radix/`cmdk`). O catálogo curado é importado estaticamente; se `check:bundle` indicar estouro, adicionar chunk dedicado ao catálogo em `manualChunks` no `vite.config.ts`.

### 8. Exibição e contratos
Incluir `icon`/`color` em `Card` e `toCard` (`packages/ui-contracts`). Exibir o ícone do projeto em `AppShell` (sidebar e header), no breadcrumb e em `ProjectsPage` (substituindo o avatar de letra quando houver ícone); exibir o ícone do item em `KanbanCard` (antes do título) e no cabeçalho de `ItemModal`/`ItemDetailHeader`. MCP: expor em `create_project`/`update_project`/`create_task`/`update_item`/`update_items`, no enum de `field`, em `allowedFields`/`clearableFields` e em `PROJECTION_FIELDS`.

## Risks / Trade-offs

- **Orçamento de bundle** (catálogo de ícones infla chunks) → catálogo curado de 40–60 ícones, medição com `check:bundle` e, se necessário, chunk dedicado.
- **Divergência entre catálogo e mapa de componentes** (nome válido na API sem componente no web) → teste de contrato garantindo que todo `ICON_CATALOG` tem mapeamento em `apps/web/src/lib/iconCatalog.ts` (com marcador `[CONTRATO-ESTRUTURAL]`).
- **Campos descartados silenciosamente** (schemas `.strict()`, `writableFields`, mapeamentos de adapter esquecidos) → usar o checklist de replicação do levantamento backend e cobrir com testes de integração de criar/editar projeto e item.
- **Paridade SQLite/PostgreSQL** (migração PG manual e listas fixas em testes) → atualizar `migrations.test.ts`/`parity.test.ts` e rodar `test:migrations`.
- **Acessibilidade/contraste da cor** no tema escuro → aplicar cor do swatch com contraste e `aria-label` no seletor; usar `currentColor` quando não houver cor.
- **i18n incompleto** → adicionar chaves nos 3 locales e validar com `check:i18n`.

## Migration Plan

1. Contratos: catálogo e campos em `packages/ui-contracts` (incl. `Card`/`toCard`).
2. Dados: colunas em ambos os schemas + migrações SQLite/PG + adapters + `persistence/models.ts`.
3. API: validação, rotas de projeto/item e projeção do board.
4. MCP/tool-registry: campos, enum, validação e summary.
5. Web: `IconPicker`/swatches, integração em criar/editar projeto, settings, card e modal, exibição.
6. i18n e testes/guardas (`bun run check`, `test:migrations`, `check:i18n`, `check:frontend-tests`, `check:bundle`).

**Rollback**: mudança aditiva e nullable; reverter código basta e os dados existentes permanecem válidos. Sem downtime.

## Open Questions

- Tamanho final do catálogo (proposta inicial: 40–60 ícones), a confirmar medindo o bundle.
- Edição de ícone/cor para STORY/EPIC na UI já neste ciclo (proposta: aceitar no backend para todos os tipos; UI de edição inicial em projeto e TASK/BUG, com exibição nos demais).
- Ordenação do catálogo: curada com busca (proposta) versus alfabética.
