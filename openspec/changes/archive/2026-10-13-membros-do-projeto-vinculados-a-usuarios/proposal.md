# Proposal

## Why

A seção **Membros & Squads** das configurações do projeto exige que quem administra digite o e-mail exato da pessoa. O backend só aceita e-mail que corresponda a um usuário existente no mesmo tenant (senão responde 404), mas a interface nunca oferece a lista de usuários do sistema: não há como escolher a pessoa, nem ver quem do sistema ainda não é membro. A gestão de membros fica desconectada do cadastro de usuários (módulo **Admin → Usuários**) e produz erros previsíveis de digitação.

O desencontro é maior para Gerentes: `GET /api/users` é restrito ao grupo global Admin, então um Gerente que administra o projeto consegue adicionar um membro por e-mail, mas não consegue listar usuários para escolher — precisa já saber o endereço de cor.

O modelo de dados já está correto: `memberships.user_id` referencia `users` com FK por tenant. O problema é de fluxo e de superfície de leitura, não de schema.

## What Changes

- **Seletor de usuários no dialog de adicionar membro**: o campo de e-mail livre é substituído por um seletor com busca sobre os usuários do tenant, indicando quem já é membro (e não pode ser adicionado de novo).
- **Lista de membros como recorte da lista de usuários**: "Membros do projeto" passa a ser apresentada explicitamente como o subconjunto dos usuários do tenant com membership ativa, mantendo nome, e-mail, papel no projeto e squad.
- **Novo endpoint de candidatos**: `GET /projects/:id/member-candidates` retorna os usuários do tenant com um indicador `isMember`, no escopo do projeto.
- **Permissão do novo endpoint**: acessível a quem administra o projeto (Gerente/Admin/Root conforme o escopo de projeto já existente). O módulo **Administração** continua restrito a Admin/Root — a listagem de usuários no escopo do projeto não concede acesso ao módulo.
- **`POST /projects/:id/members` aceita `userId`**: o schema passa a aceitar exatamente um entre `userId` e `email`. `email` é mantido para compatibilidade (MCP/agentes e clientes existentes); a UI passa a enviar `userId`.
- **Squads sem mudança**: continuam como agrupamento opcional dentro do projeto, com a associação de membros já existente.

Fora de escopo, explicitamente: tornar todo usuário do tenant membro de todo projeto (a membership por projeto é o que sustenta a visibilidade "Restrito" e os papéis por projeto), convite por e-mail para quem não tem conta, e criação de usuários a partir das configurações do projeto.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `project-members-ui`: o dialog de adicionar membro passa a selecionar entre os usuários do tenant em vez de aceitar e-mail livre; a lista de membros passa a ser apresentada como recorte da lista de usuários do tenant; novo endpoint de candidatos a membro.
- `user-permissions`: a listagem de usuários do tenant passa a ser disponível no escopo de um projeto para quem administra esse projeto, sem conceder o módulo Administração nem ampliar o escopo global do usuário.

## Impact

**API**
- `apps/api/src/routes/projects.ts`: novo `GET /projects/:id/member-candidates`; `POST /projects/:id/members` aceitando `userId`.
- `apps/api/src/validation.ts`: schema de adicionar membro aceitando exatamente um entre `userId` e `email`.
- `apps/api/src/persistence/ports.ts` e adapters `db/sqlite/adapter.ts` / `db/postgres/adapter.ts`: leitura de candidatos reaproveitando `identity.listUsers` e `projects.listProjectMembers` (ou uma consulta equivalente por tenant + projeto).
- Documento OpenAPI gerado e testes de contrato de erro/observabilidade que enumeram rotas de `projectsRouter`.

**Web**
- `apps/web/src/features/project-settings/ProjectSettingsScreen.tsx` e `features/project-settings/components/OrganizationSettingsSections.tsx`: dialog com seletor de usuários.
- `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`: novas chaves e remoção das chaves de e-mail livre.
- Contratos de tela em `apps/web/src/*.test.ts` que leem o código-fonte das telas.

**Documentação e testes**
- `docs/azyboard-wiki/07 - Configuracoes do Projeto/Gerenciar Membros e Papeis.md` (o passo "informe o e-mail" deixa de valer).
- `e2e/journeys.ts` se a jornada tocar o dialog de membros.

**Sem impacto**
- Sem migration: o vínculo `memberships.user_id` já existe.
- Sem mudança em squads, em `project-visibility` (membership por projeto inalterada) e no módulo Administração.
- Compatibilidade preservada para clientes que adicionam membros por e-mail.
