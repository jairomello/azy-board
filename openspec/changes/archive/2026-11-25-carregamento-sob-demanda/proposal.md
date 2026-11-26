# Proposal

## Why

O chunk `BoardPage` estava a 0,08 KB do teto (60,96 de 61,04 KB gzip) e as
próximas mudanças do redesenho do board (visão lembrada, menu Exibir, filtros
em dois níveis) somam cerca de +3,5 KB nele. Em vez de subir o orçamento, a
decisão foi tirar do chunk o que nem toda visita usa.

A `TreeViewPage` (grade com colunas configuráveis, edição inline e criação
entre linhas) era importada de forma estática pelo `BoardScreen` e, por isso,
quem abria só o Kanban ou o Unificado baixava a Árvore inteira junto.

O mesmo vale para o chunk `SettingsPage`, a 0,42 KB do teto, que vai receber a
navegação por grupos das Configurações (+2,6 KB): o diálogo de membro e o
detalhe da versão só abrem por clique, mas vinham embutidos.

## What Changes

- A `TreeViewPage` passa a ser carregada sob demanda (`React.lazy`) quando a
  visão Árvore é exibida. Enquanto o chunk chega, o canvas mostra um indicador
  de carregamento (`role="status"`).
- O diálogo de membro (`MemberDialog`, Adicionar/Editar membro) e o detalhe
  da versão (`VersionDetailModal`) das Configurações passam a ser carregados
  sob demanda quando abertos.
- O orçamento ganha regras próprias para os novos chunks `TreeViewPage`
  (13000), `MemberDialog` (3300) e `VersionDetailModal` (2700 bytes gzip). Os
  tetos existentes não mudam.

Medido no build de produção: `BoardPage` 60,96 → 50,26 KB gzip;
`TreeViewPage` 12,15 KB; `MemberDialog` 2,75 KB; `VersionDetailModal`
2,09 KB; `index` inalterado.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `web-bundle-budget`: novos requisitos de carregamento sob demanda da visão
  Árvore do board e dos diálogos abertos por clique nas Configurações.

## Impact

- `apps/web/src/features/board/BoardScreen.tsx` (import sob demanda e
  `Suspense` em volta da Árvore).
- `apps/web/src/features/project-settings/components/OrganizationSettingsSections.tsx`
  e `DeliverySettingsSections.tsx` (diálogos sob demanda).
- `apps/web/bundle-budget.json` (regras dos novos chunks).
- Sem mudança de contrato REST, MCP, banco ou migration. A Árvore e os
  diálogos mantêm as mesmas props e o mesmo comportamento depois de carregados.
