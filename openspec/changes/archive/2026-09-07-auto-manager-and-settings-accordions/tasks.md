## 1. Backend — Auto-gerente na criação de projeto

- [x] 1.1 Alterar fallback de `managerUserId` na rota `POST /projects` (`apps/api/src/routes/projects.ts`): de `body.managerUserId ?? null` para `body.managerUserId ?? ctx.userId`
- [x] 1.2 Adicionar teste de integração: criar projeto sem `managerUserId` e verificar que a resposta contém o ID do criador como gerente
- [x] 1.3 Adicionar teste de integração: criar projeto com `managerUserId` explícito e verificar que o valor informado é persistido (não sobrescrito)

## 2. Frontend — SettingsPage com accordions

- [x] 2.1 Importar `AccordionSection` e `AccordionToolbar` na `SettingsPage`
- [x] 2.2 Definir array `sectionIds` com os 10 IDs das seções na ordem atual (board-format, visibility, planning, columns, manager, members-squads, cost-centers, modules, sprints, versions)
- [x] 2.3 Adicionar estado `openSections` inicializado com `new Set(['board-format', 'visibility'])` e função `toggleSection`
- [x] 2.4 Renderizar `<AccordionToolbar>` acima das seções, passando `sectionIds` filtrados (excluindo `modules` quando `boardMode === 'SIMPLE'`)
- [x] 2.5 Envolver cada seção existente em `<AccordionSection>` com `id`, `title`, `isOpen` e `onToggle` apropriados
- [x] 2.6 Remover estilos CSS duplicados das seções (os accordions já fornecem border, padding, rounded)
- [x] 2.7 Ajustar seção "Módulos" para participar dinamicamente do array `sectionIds` apenas quando `boardMode === 'HIERARCHICAL'`

## 3. i18n — Títulos das seções

- [x] 3.1 Adicionar chaves i18n para títulos das seções no accordion (PT-BR, EN, ES) em `settings.json`, reaproveitando chaves existentes onde já houver (ex.: `settings:columns`, `settings:modules`, `settings:versions`)

## 4. Testes de contrato

- [x] 4.1 Adicionar teste de contrato verificando que a `SettingsPage` renderiza `AccordionToolbar` e `AccordionSection` para cada seção visível
- [x] 4.2 Verificar typecheck, lint e build
