# Proposal

Board ref: `b49b9d8c-51db-4cff-9bf1-709f0dda5052` (card T53).

## Why

O catálogo de ícones do produto tem apenas 60 opções, organizadas como uma lista
única sem categorias, o que é pouco para times de tecnologia, service management
(ITIL) e gestão de projetos. Além disso, embora o `ICON_CATALOG` seja a fonte
única de nomes válidos, algumas vias de escrita (criação em lote, duplicação de
estrutura e tools MCP) aceitam qualquer string kebab-case, permitindo persistir
ícones que não existem no catálogo e não renderizam.

## What Changes

- Ampliar `ICON_CATALOG` (ainda 100% `lucide-react`, ISC, sem nova dependência)
  com ícones de tecnologia/dev, ITIL/service management, gestão/projetos e
  dados/IA, validados contra a versão instalada da biblioteca.
- Introduzir **categorias** no catálogo compartilhado e expor `ICON_CATEGORIES`
  (nome + rótulo i18n), mantendo `ICON_CATALOG` como lista plana consumível.
- Adicionar **filtro por categoria** ao `IconPicker`, preservando a busca textual.
- Fechar as lacunas de validação contra o catálogo:
  - batch de criação (`apps/api/src/routes/batch.ts`);
  - duplicação de estrutura (`apps/api/src/routes/structureDuplication.ts`);
  - MCP / tool-registry (enum do catálogo no schema exposto e validação por
    pertencimento em `update_item`/`update_items`).
- Internacionalizar os rótulos de categoria em PT-BR, EN e ES.
- Cobrir com testes: contrato estrutural do catálogo, categorias/filtro, e
  rejeição de ícone fora do catálogo em batch, duplicação e MCP.

Não-objetivos: nova dependência de ícones; upload de ícone/imagem customizado;
categorias por coluna/módulo/sprint; color picker livre; mudança de banco
(as colunas `icon`/`color` continuam `text` nullable, sem migração).

## Capabilities

### New Capabilities
- (nenhuma)

### Modified Capabilities
- `entity-icons`: o catálogo curado passa a ser maior e categorizado, e o
  requisito de rejeitar nomes fora do catálogo passa a valer de forma uniforme
  em todas as vias de escrita (REST, batch, duplicação de estrutura e MCP).

## Impact

- **Contrato compartilhado**: `packages/ui-contracts/src/index.ts`
  (`ICON_CATALOG`, `ICON_CATEGORIES`, `IconName`, helpers).
- **Web**: `apps/web/src/lib/iconCatalog.ts` (mapa nome→componente),
  `apps/web/src/components/IconPicker.tsx` (filtro por categoria),
  `apps/web/src/i18n/locales/{pt-BR,en,es}/common.json` (rótulos).
- **API**: `apps/api/src/routes/batch.ts`,
  `apps/api/src/routes/structureDuplication.ts` (validação contra o catálogo).
- **MCP/tool-registry**: `packages/tool-registry/src/registry.ts` (enum no schema
  exposto), `packages/tool-registry/src/validation.ts` (pertencimento).
- **Testes**: `apps/web/src/lib/iconCatalog.test.ts`,
  `apps/web/src/components/appearance-picker.test.tsx`, testes de API/integração
  e do tool-registry.
- **Sem migração de banco**; sem alteração de licenças (lucide-react, ISC).
- **Bundle**: o chunk dedicado `icons` (`apps/web/vite.config.ts`) cresce; o
  `check:bundle` deve continuar verde.
