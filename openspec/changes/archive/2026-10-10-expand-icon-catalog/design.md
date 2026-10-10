# Design

## Context

Ver `proposal.md` para a motivação. Estado atual relevante:

- `ICON_CATALOG` (60 ícones, kebab-case) e `ICON_COLORS` são a fonte única de nomes
  válidos em `packages/ui-contracts/src/index.ts`; `IconName` deriva de `as const`.
- O mapa nome → componente `LucideIcon` existe apenas no web (`apps/web/src/lib/iconCatalog.ts`),
  garantido por um teste de contrato estrutural (`[CONTRATO-ESTRUTURAL]`); o chunk de ícones
  já é isolado em `apps/web/vite.config.ts` (`manualChunks` → `icons`).
- O picker (`apps/web/src/components/IconPicker.tsx`) é uma grade com busca textual, sem categorias.
- A API valida o campo por Zod (`optionalIcon`/`optionalIconColor` em `apps/api/src/validation.ts`),
  mas há três vias que **não** validam pertencimento ao catálogo: criação em lote
  (`apps/api/src/routes/batch.ts`, checa só `typeof string`), duplicação de estrutura
  (`apps/api/src/routes/structureDuplication.ts`, `z.string().nullable()` sem refine) e o
  tool-registry MCP (`packages/tool-registry/src/validation.ts` aceita qualquer kebab-case e o
  schema exposto usa o fallback genérico `nullable({ type: 'string' })` em
  `packages/tool-registry/src/registry.ts`).
- `packages/tool-registry` **não** depende de `@azy-board/ui-contracts` hoje (só de
  `@azy-board/assistant-contracts`); para validar por pertencimento é preciso adicionar essa
  dependência (pacote puro TS, sem React — o mapa de componentes continua só no web).

## Goals / Non-Goals

**Goals:**
- Um único lugar de verdade para ícones **e categorias**, consumido por web, API e MCP.
- Validação por pertencimento em **todas** as vias de escrita, sem camadas paralelas de listas.
- Filtro por categoria + busca no picker, com i18n dos rótulos.

**Non-Goals:**
- Nova dependência de ícones, upload customizado, ícone dinâmico de CDN.
- Restringir o campo `color` no schema MCP global: ele é compartilhado com **tags**
  (`create_tag`/`update_tag` aceitam hex livre validated por `assertHexColor`); a paleta
  restrita continua validada na API para projeto/item.
- Migração de banco ou troca de licença.

## Decisions

### 1. Categorias no contrato: `ICON_CATEGORIES` (array ordenado) + `IconCategoryId`
Em `packages/ui-contracts`, além do `ICON_CATALOG` plano (mantido para compatibilidade),
adicionar:

```ts
export const ICON_CATEGORY_IDS = ['technology', 'itil', 'project', 'data', 'communication', 'organization', 'documents', 'commerce', 'media'] as const
export type IconCategoryId = (typeof ICON_CATEGORY_IDS)[number]
export const ICON_CATEGORIES: ReadonlyArray<{ id: IconCategoryId; icons: IconName[] }> = [...]
```

Racional: um array ordenado de `{ id, icons }` serve de fonte única para **ordem de exibição**,
**filtro** e **navegação**, e mantém o catálogo plano derivável (`ICON_CATALOG` = concatenação das
categorias, em ordem). Cada ícone pertence a exatamente uma categoria. Alternativas descartadas:
- `Record<IconName, IconCategoryId>` (mapa direto): sem ordem de exibição e obriga duplicação de
  valores; o array com `icons` atende aos dois usos.
- Derivar categoria por prefixo do nome: frágil — nomes lucide não têm prefixo semântico estável.
- Um novo pacote `@azy-board/icon-catalog`: desnecessário, `ui-contracts` já é dependência
  compartilhada.

### 2. Categorias propostas e ampliação do acervo
Set catálogo alvo **~190–200 ícones**, 100% `lucide-react` (ISC), validados contra a versão
instalada (`^0.460.0`) na implementação — a lista concreta fica em `packages/ui-contracts` e o
teste de contrato garante que todo nome tem componente. Blocos temáticos por categoria:

- `technology` (Tecnologia): `code`, `terminal`, `git-branch`, `git-merge`, `git-pull-request`,
  `github`, `container`, `box`, `boxes`, `server`, `cloud`, `hard-drive`, `memory-stick`,
  `circuit-board`, `cpu`, `monitor`, `smartphone`, `webhook`, `network`, `wifi`, `router`,
  `plug`, `cable`, `qr-code`, `binary`, `braces`, `blocks`, `workflow`, `waypoints`, `bot`, `bug`.
- `itil` (ITIL/Serviços): `ticket`, `clipboard-check`, `clipboard-x`, `list-checks`, `refresh-cw`,
  `rotate-cw`, `repeat`, `recycle`, `life-buoy`, `heart-pulse`, `stethoscope`, `siren`,
  `alert-triangle`, `alert-octagon`, `shield-check`, `shield-alert`, `user-check`, `headset`,
  `phone-call`, `history`, `gauge`, `timer`, `hourglass`, `circle-help`, `file-check`, `file-warning`.
- `project` (Gestão/Projetos): `kanban`, `kanban-square`, `columns`, `layout-grid`, `list-todo`,
  `list-tree`, `table`, `chart-network`, `bar-chart`, `line-chart`, `pie-chart`, `trending-up`,
  `milestone`, `flag-triangle-right`, `goal`, `target`, `crosshair`, `route`, `signpost`, `draft`,
  `scaling`, `layers`, `archive`, `inbox`, `folders`, `folder-tree`, `folder-git`, `calendar-check`,
  `calendar-range`, `users-round`, `user-cog`, `crown`, `gem`, `briefcase`, `building`, `factory`,
  `warehouse`, `hard-hat`, `truck`, `ruler`, `pencil-ruler`, `id-card`, `badge-check`, `rocket`.
- `data` (Dados/IA): `database`, `database-zap`, `brain-circuit`, `sparkles`, `scan`, `atom`,
  `orbit`, `dna`, `flask-conical`, `test-tube`, `wand-sparkles`, `scan-face`, `fingerprint`,
  `table-2`, `list-filter`, `sliders-horizontal`, `arrow-up-down`.
- `communication` (Comunicação/Tempo): `calendar`, `clock`, `bell`, `mail`, `message-square`,
  `send`, `phone`, `chat`, `inbox`, `alarm-clock`, `watch`.
- `organization` (Pessoas/Organização): `users`, `user`, `home`, `building-2`, `user-plus`,
  `user-round`, `star`, `heart`, `bookmark`, `flag`, `map`, `compass`, `globe`.
- `documents` (Documentos): `file-text`, `clipboard-list`, `book-open`, `graduation-cap`,
  `book-marked`, `file`, `files`, `pen-tool`, `palette`, `brush`, `pencil`, `wand`.
- `commerce` (Comércio/Conquistas): `trophy`, `medal`, `award`, `gift`, `shopping-cart`,
  `credit-card`, `wallet`, `gem`, `crown`.
- `media` (Mídia/Lazer): `camera`, `image`, `film`, `music`, `gamepad-2`, `tv`, `headphones`.

> A distribuição final é refinada na implementação após validar nomes contra o pacote instalado;
> nomes inexistentes são substituídos por equivalentes reais da `lucide-react`.

### 3. Picker com filtro por categoria
Em `apps/web/src/components/IconPicker.tsx`: linha de **chips** (uma por categoria + "Todos") acima
da busca, mantendo a grade `grid-cols-8` e a semântica `role="listbox"`. O estado `category`
combinado ao `search` filtra os ícones. Rótulos via i18n (`appearance.categories.<id>`). O teste de
interação existente (`appearance-picker.test.tsx`) ganha casos de filtro por categoria e combinação
com busca. Alternativa descartada: tabs por categoria — chips com scroll horizontal escalam melhor
com 9 categorias.

### 4. Validação uniforme por pertencimento
- **Batch** (`apps/api/src/routes/batch.ts`): ao normalizar cada operação, validar `icon` com
  `isIconName`; inválido → 400 `INVALID_REQUEST` com mensagem clara, sem criar o item. O mesmo
  ponto que já valida `priority`/`type` passa a validar o ícone.
- **Duplicação** (`apps/api/src/routes/structureDuplication.ts`): `icon`/`color` no `planSchema`
  ganham `z.string().refine(isIconName).nullable()` e `refine(isIconColor)`. Seguro porque o plano
  é gerado pelo servidor a partir de dados já validados; como a mudança só **adiciona** ícones,
  valores legados continuam pertencendo ao catálogo.
- **MCP / tool-registry**: adicionar dependência `@azy-board/ui-contracts` a `packages/tool-registry`.
  No schema exposto (`registry.ts`), tratar o campo `icon` com enum derivado de `ICON_CATALOG`
  (antes do fallback genérico) — válido globalmente porque `icon` só existe em projeto/item.
  Em `validation.ts`, trocar o teste de regex kebab-case por `isIconName`. O campo `color` **não**
  é restringido no schema MCP (compartilhado com tags); a API continua responsável pela paleta.

### 5. i18n
Adicionar em `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json` a sub-árvore
`appearance.categories` com os rótulos das categorias e `appearance.allIcons` ("Todos").
Sem mudança de schema de preferências.

## Risks / Trade-offs

- **Bundle crece** (importar ~140 ícones novos no chunk `icons`) → o chunk dedicado já existe;
  rodar `check:bundle` e, se estourar, sondar nomes que possuem variantes com/a sem `-2` redundantes.
- **Nomes lucide inexistentes na versão instalada** → cada nome é validado contra
  `lucide-react ^0.460` durante a implementação; o teste de contrato estrutural bloqueia falhas.
- **Schema MCP com enum grande** (≈200 valores) → payload dos schemas cresce, mas é um enum estável
  e estático; sem impacto de runtime (fonte única no contrato).
- **Divergência entre categorias e catálogo** (ícone sem categoria ou duplicado) → guardas
  estruturais nos testes (`iconCatalog.test.ts`) validam unicidade e cobertura total.
- **Batch/duplicação ainda sem teste de ícone inválido** → adicionar cenários em `integration.test.ts`.

## Migration Plan

1. Contratos (`packages/ui-contracts`): `ICON_CATEGORIES`, `IconCategoryId` e catálogo ampliado.
2. Web: mapa de componentes, picker com filtro, i18n.
3. API: validação em batch e duplicação.
4. MCP/tool-registry: dependência, enum, validação.
5. Testes/guardas: `bun run check`, `check:i18n`, `check:frontend-tests`, `check:bundle`.

**Rollback**: mudança puramente aditiva (novo catálogo maior + categorias + validação mais rígida);
reverter o código basta, dados existentes permanecem válidos. Sem migração e sem downtime.

## Open Questions

- Nada em aberto: a lista concreta de ícones por categoria é validada contra o pacote instalado
  na implementação sem alterar specs, abordagem ou divisão de tarefas.