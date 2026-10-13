# Tasks

## 1. API — listagem de candidatos a membro

- [x] 1.1 Implementar `GET /projects/:id/member-candidates` em `apps/api/src/routes/projects.ts` com `requireRole('ADMIN')`, compondo `persistence.identity.listUsers` e `persistence.projects.listProjectMembers` e retornando `id`, `name`, `email`, `avatarUrl`, `globalGroup` e `isMember`; comentar o ponto de isolamento com `// [TENANT]`. Verificação: testes de integração em `apps/api/src/integration.test.ts` cobrindo 200 para quem administra o projeto, `isMember = true` para usuário já membro, 403 para Membro de Equipe, 404 para projeto de outro tenant e 404 para projeto restrito sem vínculo.

## 2. API — adicionar membro por identificador de usuário

- [x] 2.1 Estender `addProjectMemberSchema` em `apps/api/src/validation.ts` para exigir exatamente um entre `userId` e `email`, e ajustar `POST /projects/:id/members` para resolver o usuário por `userId` validando o tenant ativo. Verificação: testes de integração cobrindo 201 por `userId`, 400 sem identificador, 400 com os dois identificadores, 404 para `userId` de outro tenant, 409 para usuário já membro e 201 pelo caminho por `email`.
- [x] 2.2 Confirmar que a ferramenta de agente `add_member` continua válida com `email` obrigatório. Verificação: `bun run test:mcp-catalog` e o teste de registry que valida `packages/tool-registry/src/fields.ts` passam sem alteração.
- [x] 2.3 Regenerar `docs/generated/openapi.json` com `bun run generate:docs`. Verificação: `bun run check:docs` sem divergência de artefato gerado.

## 3. Web — seletor de usuários no dialog de membros

- [x] 3.1 Carregar os candidatos via `GET /projects/:id/member-candidates` no fluxo de dados das configurações (`apps/web/src/features/project-settings/hooks/useProjectSettingsData.ts`) e expor candidatos, estado de carregamento e erro ao dialog. Verificação: teste em `apps/web/src/features/project-settings/` cobrindo filtro por nome ou e-mail, sinalização de `isMember` e estado de erro.
- [x] 3.2 Substituir o campo de e-mail por busca com lista de usuários em `components/OrganizationSettingsSections.tsx`, mantendo os selects de papel e squad, impedindo selecionar quem já é membro e enviando `userId` a partir de `ProjectSettingsScreen.tsx`. Verificação: teste de componente confirmando que não existe campo de e-mail livre, que usuário já membro não é selecionável e que o `userId` escolhido é enviado na requisição.
- [x] 3.3 Atualizar as chaves de i18n em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json` (mensagens do seletor, removendo `memberEmailPlaceholder`). Verificação: `bun run check:i18n` e `bun run check:frontend-tests` passam, sem contrato de tela referenciando as chaves removidas.

## 4. Documentação

- [x] 4.1 Atualizar `docs/azyboard-wiki/07 - Configuracoes do Projeto/Gerenciar Membros e Papeis.md` para descrever a escolha entre os usuários do tenant no lugar de digitar o e-mail. Verificação: `bun run check:docs` passa sem link quebrado nem afirmação proibida.

## 5. Verificação de integração

- [x] 5.1 Rodar `bun run check` e confirmar typecheck, lint, testes e build sem falhas.
- [x] 5.2 Rodar `bun run test:smoke` e confirmar o fluxo web/API ponta a ponta.
