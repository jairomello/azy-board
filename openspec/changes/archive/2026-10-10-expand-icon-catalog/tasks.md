# Tasks

Board ref: `b49b9d8c-51db-4cff-9bf1-709f0dda5052` (card T53).

## 1. Contrato compartilhado — `packages/ui-contracts`

- [x] 1.1 Ampliar `ICON_CATALOG` para ~190–200 ícones (kebab-case, `lucide-react`), cobrindo tech/dev, ITIL/serviços, gestão/projetos e dados/IA; validar cada nome contra a versão instalada apontando o `lucide-react` do monorepo.
- [x] 1.2 Adicionar `ICON_CATEGORY_IDS` (`as const`), `IconCategoryId` e `ICON_CATEGORIES` (array ordenado `{ id, icons: IconName[] }`); cada ícone em exatamente uma categoria e a concatenação das categorias == `ICON_CATALOG`.
- [x] 1.3 Manter `IconName`, `isIconName`, `isIconColor`, `DEFAULT_PROJECT_ICON` e `DEFAULT_ITEM_ICON` sem quebra de contrato.

## 2. Web — mapa, picker e i18n

- [x] 2.1 Mapear todos os ícones novos em `apps/web/src/lib/iconCatalog.ts` (`ICON_COMPONENTS`), respeitando `Record<IconName, LucideIcon>`.
- [x] 2.2 Adicionar filtro por categoria ao `IconPicker` (`apps/web/src/components/IconPicker.tsx`): chips por categoria + "Todos", combinado com a busca textual, sem quebrar `role="listbox"`/`aria-selected`.
- [x] 2.3 Adicionar i18n `appearance.categories.*` e `appearance.allIcons` em `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json` (chaves `check:i18n` equivalentes nos 3 idiomas).

## 3. API — validação uniforme

- [x] 3.1 Em `apps/api/src/routes/batch.ts`, validar `icon` de cada operação com `isIconName` durante a normalização; inválido → 400 `INVALID_REQUEST` sem criar itens.
- [x] 3.2 Em `apps/api/src/routes/structureDuplication.ts`, aplicar `refine(isIconName)`/`refine(isIconColor)` em `icon`/`color` do `planSchema`.

## 4. MCP / tool-registry

- [x] 4.1 Adicionar dependência `@azy-board/ui-contracts` a `packages/tool-registry` (pacote puro TS, sem React).
- [x] 4.2 Em `packages/tool-registry/src/registry.ts`, expor o campo `icon` com enum derivado de `ICON_CATALOG` (antes do fallback `nullable({ type: 'string' })`); não restringir `color` globalmente (compartilhado com tags).
- [x] 4.3 Em `packages/tool-registry/src/validation.ts` (campo `icon` em `update_item`/`update_items`), trocar a checagem de regex kebab-case por `isIconName`.

## 5. Testes e guardas

- [x] 5.1 Ampliar `apps/web/src/lib/iconCatalog.test.ts`: contrato estrutural continua garantindo componente para todo nome; adicionar guardas de categorias (cobertura total, unicidade, ordem, `IconName` derivado).
- [x] 5.2 Ampliar `apps/web/src/components/appearance-picker.test.tsx`: filtro por categoria, combinação categoria+busca, voltar ao default.
- [x] 5.3 Adicionar em `apps/api/src/integration.test.ts` cenários: batch com `icon` fora do catálogo → 400; plano de duplicação com `icon`/`color` inválidos → 422/400.
- [x] 5.4 Adicionar/atualizar testes do tool-registry: `icon` fora do catálogo rejeitado em `update_item`/`update_items`; schema exposto enumera o catálogo.
- [x] 5.5 Rodar `bun run check` (typecheck + lint + testes + build), `bun run test:smoke`, `check:i18n` e `check:bundle`; resolver qualquer estouro do chunk `icons`.