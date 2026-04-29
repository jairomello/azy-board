## Why

Módulos existem na hierarquia do sistema mas não têm tela de gerenciamento: só podem ser criados implicitamente ao criar épicos, sem possibilidade de editar ou excluir. Versões não existem no sistema e são necessárias para rastrear em qual release cada item (épico, história, task, bug) será disponibilizado. Ambos os recursos pertencem à configuração do projeto e devem ser gerenciados na tela de Settings.

## What Changes

- **Seção "Módulos" em Settings**: CRUD completo de módulos (criar, renomear, excluir com tratamento de épicos órfãos) na tela de configurações do projeto. A API já tem POST/GET/PATCH mas falta DELETE e a UI completa.
- **Seção "Versões" em Settings**: CRUD de versões do projeto com campos: nome da versão, data de lançamento, descrição, situação (Planejada / Em desenvolvimento / Lançada / Cancelada). Ações: criar, editar (abre form + lista de itens da versão), excluir, visualizar.
- **Campo versão nos itens**: Campo opcional `versionId` em épicos, histórias, tasks, subtasks e bugs para indicar em qual versão o item será entregue. Exibido e editável nas modais de cada tipo de item.

## Capabilities

### New Capabilities

- `version-management`: CRUD de versões de projeto com campos (nome, data, descrição, situação), listagem em Settings, visualização de itens por versão e campo opcional de versão em todos os tipos de item

### Modified Capabilities

- `module-management`: adição da UI de gerenciamento de módulos em Settings (lista, criar, editar, excluir) e endpoint DELETE de módulo na API
- `project-management`: tela de Settings ganha duas novas seções (Módulos e Versões)
- `card-edit-ui`: modal de TASK/BUG ganha campo opcional "Versão"
- `epic-story-ui`: modais de EPIC e STORY ganham campo opcional "Versão"

## Impact

- **Banco de dados**: nova tabela `project_versions`; nova coluna `version_id` em `items`
- **Backend**: endpoint DELETE `/projects/:id/modules/:moduleId`; endpoints CRUD `/projects/:id/versions`; endpoint `GET /projects/:id/versions/:versionId/items`; campo `versionId` no POST/PATCH de items
- **Frontend**: `SettingsPage` ganha seções "Módulos" e "Versões"; `ItemModal` ganha campo "Versão"; `EpicModal` e `StoryModal` ganham campo "Versão"; novo componente `VersionDetailModal`
- **Sem breaking changes**: `version_id` e `module` em items são opcionais; nenhum campo existente é removido
