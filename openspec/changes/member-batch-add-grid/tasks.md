# Tasks

## 1. Persistência: candidatos paginados e adição em lote

- [x] 1.1 Adicionar à porta `ProjectsPort` (`apps/api/src/persistence/ports.ts`) os métodos `listMemberCandidates(context, projectId, { q, eligibleOnly, limit, offset })` retornando `{ items: MemberCandidateRecord[], total: number }` e `addProjectMembers(context, projectId, inputs)` retornando os `userId` criados. Verificar com `bun run typecheck` que os dois adapters passam a exigir as implementações.
- [x] 1.2 Implementar `listMemberCandidates` no adapter SQLite (`apps/api/src/db/sqlite/adapter.ts`): usuários do tenant, filtro `lower(name) LIKE` / `lower(email) LIKE` com `%termo%` quando `q` é informado, exclusão de quem já é membro do projeto quando `eligibleOnly` for verdadeiro, `isMember` calculado na projeção, `ORDER BY name` (locale pt-BR) e `total` pela mesma condição. Verificar com um teste de unidade no adapter cobrindo busca por nome, busca por e-mail, `eligibleOnly` ligado/desligado, `limit`/`offset` e `total`.
- [x] 1.3 Implementar `addProjectMembers` no adapter SQLite inserindo todas as entradas dentro de `runSqliteAtomic`, emitindo os eventos de metadados `members` e `squads` uma única vez e rejeitando `squadId` fora do projeto com `SQUAD_NOT_IN_PROJECT`. Verificar com teste de unidade que uma entrada inválida não deixa nenhuma membership parcial gravada.
- [x] 1.4 Implementar os mesmos dois métodos no adapter PostgreSQL (`apps/api/src/db/postgres/adapter.ts`), usando `ILIKE`/`lower()` para a busca e uma transação única para o lote. Verificar com o teste de paridade existente (`apps/api/src/db/postgres/parity.test.ts`) estendido para cobrir os dois métodos com os mesmos casos do SQLite.

## 2. API: candidatos paginados e `POST /projects/:id/members/batch`

- [x] 2.1 Reescrever `GET /projects/:id/member-candidates` (`apps/api/src/routes/projects.ts`) para aceitar `q`, `eligibleOnly`, `page`, `limit` e `cursor` e responder o envelope `{ data, page, limit, total, hasMore, nextCursor }` (padrão de `GET /projects/:id/items`: `limit` padrão 50, teto 100, cursor base64url do offset, cursor inválido → 400), mantendo `isMember` no item. Manter `requireRole('ADMIN')` e `[TENANT]`. Verificar com testes de integração de paginação (página 2 com `limit` menor que o total), de cursor inválido e de `eligibleOnly` omitindo quem já é membro.
- [x] 2.2 Criar o schema Zod da adição em lote (mínimo 1 entrada, máximo 200, `role` restrito a `ADMIN|MEMBER|VIEWER`, `squadId` opcional) em `apps/api/src/validation.ts`. Verificar com teste de integração que lista vazia responde 400 e papel inválido responde 400.
- [x] 2.3 Implementar `POST /projects/:id/members/batch` em `apps/api/src/routes/projects.ts`: validar em massa os usuários do tenant ativo e os squads do projeto, separar já membros, chamar `addProjectMembers` e responder 200 com `{ created, skipped, invalid }` conforme o design. Verificar com testes de integração para: vários usuários válidos criados na mesma requisição; usuário já membro em `skipped` sem duplicar vínculo; `userId` de outro tenant e `squadId` de outro projeto em `invalid` sem criar membership; 403 para quem não administra o projeto.
- [x] 2.4 Ajustar os testes de integração existentes de `member-candidates` (`apps/api/src/integration.test.ts`) para o novo envelope paginado, preservando as asserções de `isMember` e cobrindo o modo `eligibleOnly`. Verificar com `bun run test:integration`.

## 3. Web: modelo, comportamento e defaults

- [x] 3.1 Atualizar `apps/web/src/features/project-settings/model/types.ts`: manter `isMember` em `MemberCandidate`, adicionar o tipo do envelope paginado de candidatos e o tipo do resultado do lote (`created`/`skipped`/`invalid`). Verificar com `bun run typecheck`.
- [x] 3.2 Em `apps/web/src/features/project-settings/model/behavior.ts`, substituir `filterMemberCandidates` (filtro local) e `memberCandidateState` pelos helpers da grade: `defaultSquadId(squads)`, `selectionFromRow` / `toggleSelection`, contador de selecionados e `batchSummaryMessage(result, t)` para a mensagem do resultado do lote. Verificar com testes de unidade cobrindo: 0 squads → vazio, 1 squad → pré-selecionado, 2+ squads → vazio, alternância de seleção preservando as demais linhas e formatação do resumo com criados/ignorados/inválidos.

## 4. Web: carregamento dos candidatos sob demanda

- [x] 4.1 Criar o hook `useMemberCandidates(projectId, term, enabled)` em `apps/web/src/features/project-settings/hooks/` usando `useInfiniteQuery` com chave derivada de `queryKeys.settings(userId, projectId, 'memberCandidates')` mais o termo, `getNextPageParam` a partir de `nextCursor` e `enabled` só quando o dialog está aberto. Verificar com teste do hook que a primeira página é carregada, que `fetchNextPage` acrescenta a próxima e que a consulta não dispara com o dialog fechado.
- [x] 4.2 Remover a consulta `memberCandidates` de `useProjectSettingsData` (`hooks/useProjectSettingsData.ts`) e o encaminhamento das props correspondentes em `ProjectSettingsScreen.tsx` e `OrganizationSettingsSections.tsx`, mantendo `invalidate('members')` invalidando o prefixo `memberCandidates`. Verificar com `bun run typecheck` e com os testes existentes de Settings passando.

## 5. Web: grade compacta no dialog de adição

- [x] 5.1 Reescrever o modo `add` de `MemberDialog.tsx` como grade compacta: cabeçalho fixo com `checkbox | Nome | E-mail | Squad | Papel`, checkbox por linha, selects de squad e papel por linha, filtro no topo com debounce de ~250 ms, contador de selecionados, controle "Carregar mais" acionado também por `IntersectionObserver` e confirmação em lote. Manter o modo `edit` inalterado. Verificar com teste de componente que múltiplas linhas marcadas geram um único envio com papel/squad de cada linha.
- [x] 5.2 Preservar as seleções ao trocar o filtro e ao carregar mais páginas, mantendo no rodapé o total de selecionados mesmo quando a pessoa não está visível. Verificar com teste de componente que digitar um novo termo não desmarca as linhas já marcadas e que "Carregar mais" preserva as marcações anteriores.
- [x] 5.3 Exibir o resultado do lote após confirmar (criados, já membros, inválidos), fechando o dialog apenas quando não houver inválidos. Verificar com teste de componente que o resumo é exibido quando a resposta traz `invalid` e que o dialog fecha quando todas as entradas foram criadas.
- [x] 5.4 Adicionar as chaves novas e remover a chave órfã `memberAlreadyMember` em `apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json` (paridade obrigatória entre os três idiomas). Verificar com `bun run check:i18n` (ou o script de i18n do projeto) sem erros de paridade.
- [x] 5.5 Atualizar `docs/azyboard-wiki/07 - Configuracoes do Projeto/Gerenciar Membros e Papeis.md` descrevendo o fluxo de adição em lote (grade, filtro, defaults de papel/squad). Verificar relendo a página e conferindo que os passos descritos correspondem ao dialog implementado.

## 6. Verificação integrada

- [x] 6.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir o que aparecer.
- [x] 6.2 Rodar `bun run test:smoke` e confirmar o fluxo web/API ponta a ponta: abrir Settings → Membros & Squads → Adicionar membro, filtrar, marcar várias pessoas, confirmar e ver a lista de membros atualizada.
- [x] 6.3 Validar a change com `openspec validate member-batch-add-grid --strict`.

## Workflow follow-up

- Arquivar a change após a revisão aprovada.
- Confirmar o card do Azy Board correspondente em coluna com `baseStatus` `DONE`.
