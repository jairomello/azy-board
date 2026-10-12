# Tasks

## 1. Schema e migrations

- [x] 1.1 Adicionar `EXTERNAL` ao CHECK de `items.type` e à lista de enum do Drizzle em `apps/api/src/db/schema.ts` e `apps/api/src/db/postgres/schema.ts`; verificar com `bun run typecheck` e com o teste de paridade `apps/api/src/db/postgres/parity.test.ts`.
- [x] 1.2 Gerar as migrations SQLite e PostgreSQL para o CHECK de tipo, recriando `items` com o novo domínio; verificar aplicação limpa com `bun run test:migrations`.
- [x] 1.3 Adicionar `depends_on_project_id` à tabela `item_dependencies` nos dois schemas e migrations, com FK coerente e coluna nullable para compatibilidade; expor nos modelos e adaptadores; verificar com `parity.test.ts` e `integrity.test.ts`.
- [x] 1.4 Adicionar `external_idp` e `external_subject` (únicos por par, nullable) à tabela `users` nos dois schemas e migrations; verificar com `parity.test.ts` e `bun run test:migrations`.
- [x] 1.5 Atualizar a auditoria de integridade em `apps/api/src/db/integrity.ts` para validar a coerência de `depends_on_project_id` com o projeto real do alvo e registrar as tabelas/colunas novas em `installationMarkers.ts` e `postgres/index.ts`; verificar com `bun run test:integration` (casos de integridade) e `db/integrity.test.ts`.

## 2. Domínio e contratos compartilhados

- [x] 2.1 Adicionar `EXTERNAL` a `ItemType` em `packages/domain/src/index.ts` e atualizar `card-types` consumidores diretos; verificar com `bun run typecheck`.
- [x] 2.2 Estender `itemTypeSchema`/`updateItemSchema` em `apps/api/src/validation.ts` para `TASK | BUG | EXTERNAL` na edição e `EXTERNAL` na criação, com testes de validação; verificar com `bun run typecheck`.
- [x] 2.3 Definir o contrato de configuração de autenticação (`AuthProvider`, payload de `/auth/providers`) em `packages/api-contracts`; verificar com `bun run typecheck` e `bun run check:api-boundary`.
- [x] 2.4 Adicionar os contratos de cronograma/caminho crítico em `packages/ui-contracts` (item com datas, arestas e marcação de crítico) e o `projectId`/`projectName` do alvo em `ItemDependencyTarget`; verificar com `bun run typecheck`.

## 3. Tipo de item dependência externa (T47 / T51)

- [x] 3.1 Incluir `EXTERNAL` em `isWorkCard` (`apps/api/src/services/creationDefaults.ts`) e nas regras de criação de `apps/api/src/application/items.ts` (coluna, sprint/versão ativas, ícone padrão) e ajustar `validateHierarchy` (`application/itemRules.ts`) para `EXTERNAL` sob `STORY`/`TASK`/`BUG`; verificar com testes de criação e hierarquia.
- [x] 3.2 Adicionar prefixo `X` em `apps/api/src/utils/sequenceCode.ts` e o padrão `[ESTBX]\d+`; verificar com testes de código de sequência.
- [x] 3.3 Permitir movimentação de cards `EXTERNAL` em `moveItemApplication` e no fluxo de `batch` (`apps/api/src/routes/batch.ts`); verificar com testes de movimentação.
- [x] 3.4 Adicionar metadados e i18n do tipo (`apps/web/src/lib/itemTypeMeta.ts`, `i18n/locales/{pt-BR,en,es}/board.json`) e habilitar `Dep. Externa` no seletor de criação/edição (`BoardCommandBar.tsx`, `AddCardForm.tsx`, `ItemModal.tsx`); verificar com `bun run check:i18n` e teste de componente do seletor.
- [x] 3.5 Integrar dependências ao tipo: garantir que a checagem de ciclo, o cascade e o enriquecimento de payload (`services/itemDependencies.ts`, `routes/items.ts`, `ItemDependenciesArea.tsx`) tratem `EXTERNAL`; verificar com teste de integração criando dependência para item `EXTERNAL` e com `item-dependencies-area.test.tsx`.

## 4. Dependências cross-project (T50)

- [x] 4.1 Relaxar a validação de alvo em `apps/api/src/routes/itemDependencies.ts` para aceitar projeto acessível no mesmo tenant, validando access (restrito/oculto) e mantendo anti-IDOR; escrever testes de integração para cross-project válido, projeto inacessível e outro tenant; verificar com `bun run test:integration`.
- [x] 4.2 Ajustar a detecção de ciclo para operar sobre as arestas do tenant (incluindo cross-project) e a exclusão em cascata para os dois projetos; verificar com testes de ciclo cross-project e cascade.
- [x] 4.3 Incluir `projectId`/`projectName` do alvo no resumo de dependência dos payloads de `GET /items` e `GET /items/tree` (`apps/api/src/routes/items.ts`); verificar com teste de contrato de payload.
- [x] 4.4 Adicionar seleção de projeto no formulário de dependência em `apps/web/src/components/ItemDependenciesArea.tsx`, recarregando a lista de itens por projeto e respeitando acesso; verificar com teste de componente e `bun run check:bundle`.

## 5. Replanejamento automático de datas (T48)

- [x] 5.1 Implementar o serviço de cronograma em `apps/api/src/services` (ordenação topológica, ancoragem FS/SS/SF/FF + lag, duração por datas, itens concluídos pinados, itens sem data ignorados) com testes unitários cobrindo os quatro tipos, lag negativo e conclusão.
- [x] 5.2 Expor endpoint de recálculo (ex.: `POST /projects/:projectId/schedule/recalculate`) com RBAC de escrita e idempotência, retornando o resumo de itens alterados; verificar com testes de integração e autorização.
- [x] 5.3 Adicionar o botão/ação de recálculo e o resumo na UI do board, com i18n; verificar com teste de componente e `bun run check:i18n`.
- [x] 5.4 Documentar a regra de datas/duração do recálculo no `design.md` de uso interno já coberto e registrar comportamento no `CHANGELOG`; verificar com revisão e `bun run typecheck`.

## 6. Cálculo de caminho crítico (T49)

- [x] 6.1 Implementar o cálculo do caminho crítico no serviço de cronograma (maior caminho por duração + lag, ignorando itens sem datas e sinalizando-os) com testes unitários.
- [x] 6.2 Expor leitura do caminho crítico (endpoint/serviço de projeto, somente leitura) e retornar os ids sinalizados; verificar com teste de integração.
- [x] 6.3 Adicionar o toggle de caminho crítico e o destaque visual no board, habilitado apenas com dependências cadastradas, com i18n; verificar com teste de componente e `bun run check:bundle`.

## 7. Ferramentas MCP e Azy Agent para dependências (T52)

- [x] 7.1 Declarar `list_item_dependencies`, `create_item_dependency`, `update_item_dependency` e `delete_item_dependency` em `packages/tool-registry/src/fields.ts`, `registry.ts` (descrições/schema/routing), `validation.ts` e `policies.ts` (leitura `VIEWER`, escrita `MEMBER`); verificar com `bun run test:mcp-catalog`.
- [x] 7.2 Implementar os `toolX` em `packages/tool-execution/src/http-adapter.ts` e os `case` em `packages/tool-execution/src/registry.ts` mapeando para os endpoints de dependência; verificar com testes de contrato em `apps/mcp/src`.
- [x] 7.3 Documentar as ferramentas em `apps/mcp/README.md` e na skill azyboard (`skills/azyboard/SKILL.md` + `references/mcp-operations.md`, espelhos em `.agents/`/`.opencode/`), registrando `Board ref`; verificar com `bun run test:agent-skill`.
- [x] 7.4 Cobrir leitura/escrita por agente e o fluxo do Azy Agent (a lista de ferramentas herda o catálogo) com testes; verificar com `bun run test:mcp` e testes do harness.

## 8. Login integrado Microsoft/Google opcional (T45)

- [x] 8.1 Implementar `resolveAuthConfig` lendo `AZYBOARD_AUTH_PROVIDER` (`LOCAL` padrão) e credenciais, com falha explícita na inicialização quando faltar credencial de provedor integrado; verificar com testes unitários de configuração.
- [x] 8.2 Adicionar o endpoint público `GET /auth/providers` (sem segredos) e o contrato de resposta; verificar com teste de integração (acesso sem sessão e ausência de segredos).
- [x] 8.3 Implementar o fluxo OAuth/OIDC (start com `state`/PKCE e callback com validação de `state` e `id_token`) para Microsoft e Google, reaproveitando `signJwt`/cookie e a auditoria de `loginAttempts`; verificar com testes de integração dos callbacks válido/inválido.
- [x] 8.4 Implementar a vinculação de identidade por e-mail canônico usando as colunas `external_idp`/`external_subject`, sem auto-provisionamento e sem cruzar tenants; verificar com testes de identidade existente, desconhecida e de outro tenant.
- [x] 8.5 Desabilitar o login por senha quando o provedor não for `LOCAL` (rota `apps/api/src/routes/auth.ts`), preservando API Keys de agentes; verificar com teste de integração.
- [x] 8.6 Adaptar `AuthContext` e `LoginPage.tsx` para ler `/auth/providers` e renderizar apenas os controles do provedor (senha local ou botão Microsoft/Google), com i18n; verificar com teste de componente e `bun run check:i18n`.
- [x] 8.7 Documentar a configuração de instalação do provedor (variáveis de ambiente, credenciais e comportamento da sessão) nos docs de instalação; verificar com revisão e `bun run typecheck`.

## 9. Verificação integrada e gates

- [x] 9.1 Rodar `bun run check` (typecheck + lint + persistence + api-boundary + testes + build) e corrigir qualquer regressão.
- [ ] 9.2 Rodar `bun run test:smoke` cobrindo o fluxo web/API com as dependências e o tipo `EXTERNAL`.
- [x] 9.3 Rodar `bun run test:agent-skill` e `bun run test:mcp-catalog` confirmando catálogo, policies e documentação coerentes.
- [x] 9.4 Validar a change com `openspec validate "dependencias-avancadas-e-login-integrado" --strict` e revisar o status final.

## Workflow follow-up

- Fechar cada card vinculado (`complete_task` + confirmação no board real) após a implementação, pois a change cobre T47, T48, T49, T50, T51, T52 e T45.
- Arquivar a change OpenSpec após a implementação e a confirmação dos cards.
