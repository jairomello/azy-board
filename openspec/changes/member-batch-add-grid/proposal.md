# Proposal

## Why

O dialog "Adicionar membro" atual só permite escolher uma pessoa por vez e carrega a lista
inteira de usuários do tenant de uma só vez (`GET /projects/:id/member-candidates` sem
paginação nem busca no servidor). Em empresas com milhares de usuários isso torna a
montagem de um time lenta e pesada: é preciso repetir o ciclo abrir → buscar → selecionar
→ definir papel/squad → confirmar para cada pessoa, e a carga inicial traz todos os
usuários do tenant para o cliente. A seção "Membros & Squads" precisa de uma forma de
montar o time inteiro de uma vez.

## What Changes

- Redesenhar o dialog de adição de membros como uma grade compacta com colunas
  **seleção (checkbox) | Nome | E-mail | Squad | Papel**.
- Seleção múltipla: o usuário marca quantas pessoas quiser e confirma uma única vez.
- Filtro no topo por nome ou e-mail, com filtragem rápida, consultando o servidor
  (a lista pode ter milhares de pessoas).
- Carregamento sob demanda ("Carregar mais" conforme a rolagem), substituindo a carga
  integral dos candidatos.
- Valores pré-definidos por linha: papel `MEMBER` para todos; squad já marcada quando o
  projeto tem exatamente 1 squad, `null` quando não tem nenhum squad e vazio quando tem
  mais de um (o usuário escolhe). Papel e squad permanecem editáveis por linha.
- Já membros do projeto deixam de aparecer na grade: a listagem usada pelo dialog passa a
  pedir somente candidatos elegíveis (`eligibleOnly`). O campo `isMember` permanece na
  resposta para os demais chamadores. **BREAKING** apenas para o comportamento atual do
  dialog, que listava os já membros sinalizados como "Já é membro" e desabilitados.
- Novo endpoint de adição em lote: `POST /projects/:id/members/batch` recebe uma lista de
  `{ userId, role, squadId }` e cria as memberships em uma única operação, devolvendo o
  resultado por item (criado / já membro / inválido).
- O dialog de **edição** de membro permanece como está (fluxo, campos e pré-preenchimento
  inalterados).

## Capabilities

### New Capabilities
<!-- nenhuma -->

### Modified Capabilities
- `project-members-ui`: o requisito "Seleção de membro a partir dos usuários do tenant"
  passa a descrever uma grade compacta com seleção múltipla, filtro rápido no servidor e
  carregamento sob demanda, com papel/squad pré-definidos por linha; o requisito
  "Listagem de candidatos a membro do projeto" passa a exigir busca e paginação no
  servidor e a excluir usuários que já são membros; novo requisito para a adição em lote.

## Impact

- **API** (`apps/api/src/routes/projects.ts`): `GET /projects/:id/member-candidates` ganha
  parâmetros de busca (`q`), paginação (`limit`/`cursor`) e o filtro `eligibleOnly` (usado
  pela grade para omitir quem já é membro), passando a devolver um envelope paginado; novo
  `POST /projects/:id/members/batch`. Ambos mantêm a regra de administração de projeto
  (`requireRole('ADMIN')`) e o isolamento por `tenant_id`.
- **Persistência** (`apps/api/src/persistence/ports.ts` + adapters SQLite/PostgreSQL):
  busca paginada de usuários do tenant e criação de várias memberships na mesma operação.
- **Web** (`apps/web/src/features/project-settings/`): `MemberDialog.tsx` (modo `add`),
  `model/behavior.ts`, `model/types.ts`, `hooks/useProjectSettingsData.ts`,
  `ProjectSettingsScreen.tsx` e `OrganizationSettingsSections.tsx`; novas chaves i18n em
  `pt-BR`, `en` e `es`.
- **Testes**: `member-dialog.test.tsx` e testes de integração de members/candidates em
  `apps/api/src/integration.test.ts`.
- **MCP**: `add_member` continua com a semântica atual de um membro por chamada; não faz
  parte deste escopo.
