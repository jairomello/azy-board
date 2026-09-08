## Why

Projetos criados no Azy Board frequentemente ficam sem gerente atribuído porque o campo `managerUserId` é opcional no formulário de criação e o usuário não o informa. Isso gera projetos órfãos de gestão. Além disso, a tela de configurações do projeto (`SettingsPage`) cresceu para 10 seções empilhadas, tornando a navegação longa e cansativa — o sistema já possui um padrão de accordions reutilizável em outros formulários (ItemModal, EpicModal, StoryModal) que resolve esse problema.

## What Changes

- Ao criar um projeto via `POST /projects`, se `managerUserId` não for informado, o sistema SHALL atribuir automaticamente o usuário autenticado (`ctx.userId`) como gerente do projeto.
- O usuário poderá alterar o gerente posteriormente nas configurações (comportamento existente mantido).
- A `SettingsPage` SHALL migrar todas as seções para o padrão de accordions existente (`AccordionSection` + `AccordionToolbar`), com botões "Expandir tudo" / "Recolher tudo".
- Por padrão, as duas primeiras seções iniciarão abertas e as demais fechadas.
- A seção "Módulos" (condicional para modo HIERARCHICAL) participará do sistema de accordions quando visível.

## Capabilities

### New Capabilities
- `settings-accordions`: Migração da SettingsPage para o padrão de accordions com expand/recolher tudo e estado inicial configurado.

### Modified Capabilities
- `project-management`: Criação de projeto passa a atribuir automaticamente o criador como gerente quando `managerUserId` não é informado.

## Impact

- **API (Hono)**: `apps/api/src/routes/projects.ts` — rota `POST /projects` altera fallback de `managerUserId` de `null` para `ctx.userId`.
- **Frontend**: `apps/web/src/pages/SettingsPage.tsx` — refatoração completa para usar `AccordionSection`, `AccordionToolbar` e estado `Set<string>`.
- **i18n**: Novas chaves para títulos das seções no accordion (se ainda não existirem).
- **Testes**: Teste de API para criação de projeto sem `managerUserId` verificando que o criador é atribuído como gerente. Teste de contrato para a estrutura de accordions na SettingsPage.
- **MCP/Agente**: Sem impacto — `managerUserId` já é campo existente nas ferramentas MCP.
