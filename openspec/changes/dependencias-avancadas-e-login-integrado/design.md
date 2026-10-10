# Design

## Context

Ver `proposal.md — Why`. O ponto de partida concreto, levantado no código:

- Itens são uma entidade unificada (`items`) com `type` e `parentId`; `type` é `TEXT` + `CHECK` nos dois drivers (`apps/api/src/db/schema.ts:550,621`; `apps/api/src/db/postgres/schema.ts:298,336`), sem `ENUM` de PostgreSQL — adicionar um tipo é editar o CHECK e a lista do Drizzle, não `ALTER TYPE`. O tipo canônico vive em `packages/domain/src/index.ts:9` (`ItemType`).
- As regras por tipo estão espalhadas: hierarquia (`apps/api/src/application/itemRules.ts:65-87`), criação/auto-vínculos (`apps/api/src/application/items.ts:45-97`), prefixo de sequência (`apps/api/src/utils/sequenceCode.ts:7-8`), `isWorkCard` (`apps/api/src/services/creationDefaults.ts:15-17`), validação (`apps/api/src/validation.ts:10,61,85`), metadados visuais (`apps/web/src/lib/itemTypeMeta.ts:13-22`) e i18n (`board.json`): `EXTERNAL` precisa ser adicionado em todos.
- O cadastro de dependências (T46) já existe: tabela `item_dependencies` com FKs compostas e `unique(tenant_id, item_id, depends_on_item_id)` (`apps/api/src/db/schema.ts:893-916`), rota CRUD (`apps/api/src/routes/itemDependencies.ts`), detecção de ciclo (`apps/api/src/services/itemDependencies.ts:9-28`), cascade (`apps/api/src/db/sqlite/itemUnitOfWork.ts:294-295`) e enriquecimento de payload (`apps/api/src/routes/items.ts:24-42,100-108,279-291`). O alvo é validado no **mesmo projeto** (`routes/itemDependencies.ts:40-42`) — único ponto que restringe cross-project.
- Não existe cronograma: há apenas `startDate`/`dueDate` como texto ISO (`schema.ts:591-592`) com CHECK de ordem, operações relativas de batch (`TODAY`/`OFFSET_DAYS`/`COPY_CREATED_DATE`) e nenhum recálculo de datas, calendário ou caminho crítico.
- O catálogo de ferramentas é fonte única em `packages/tool-registry` com dispatch em `packages/tool-execution` (`registry.ts`, `http-adapter.ts`); o Azy Agent monta a lista de ferramentas a partir desse catálogo (`apps/api/src/services/assistantHarness.ts:177-185`). Não há ferramentas de dependência hoje (só link/checklist/anexo/log).
- Autenticação é fixa em e-mail/senha (`apps/api/src/routes/auth.ts:19-86`, `services/auth.ts`), com identidade global por e-mail canônico, `users` sem colunas de provedor externo, e o frontend sem endpoint de descoberta de provedor (só `GET /auth/me`). Configuração de instalação segue o padrão de `resolveInstallProfile` (`apps/api/src/db/installProfile.ts:36-91`).

## Goals / Non-Goals

**Goals:**
- Introduzir `EXTERNAL` como quinto tipo de item, integrado a hierarquia, criação, sequência, i18n e catálogo de ferramentas.
- Tornar o alvo de dependência compatível com `EXTERNAL` e com cross-project, preservando isolamento multi-tenant e validação de ciclos.
- Definir o modelo de cronograma (duração/ancoragem) e o algoritmo de recálculo explícito e de caminho crítico.
- Expor as operações de dependência como ferramentas MCP/Azy Agent seguindo o padrão do catálogo.
- Tornar o método de autenticação humana uma escolha de instalação (LOCAL/MICROSOFT/GOOGLE), com tela de login adaptada, sem alterar a identidade global multi-tenant.

**Non-Goals:**
- Nivelamento de recursos, calendário de dias úteis/feriados e múltiplos calendários.
- Recálculo automático a cada edição de dependência (permanece ação explícita).
- Auto-provisionamento de usuários por provedores externos.
- Sincronização em tempo real de dependências/cronograma além dos eventos de item existentes.
- Suporte a outros provedores além de Microsoft EntraID e Google.

## Decisions

### 1. `EXTERNAL` como quinto tipo em `TEXT` + `CHECK`, tratado como card de trabalho
Adicionar `EXTERNAL` à lista do Drizzle, aos CHECKs SQLite/PostgreSQL, ao `ItemType` de `packages/domain`, ao `itemTypeSchema` e aos enums do catálogo. Reaproveitar `isWorkCard` para incluir `EXTERNAL`, de modo que ele receba coluna, sprint/versão ativas e ícone padrão como `TASK`/`BUG`. Prefixo de sequência próprio **`X`** (padrão `[ESTBX]\d+`), metadados em `itemTypeMeta.ts` (ícone + cinza ardósia) e i18n (`Dep. Externa` / `Ext. Dependence`, `i18n/locales/{pt-BR,en,es}/board.json`).

- **Hierarquia:** folha, permitida sob `STORY`/`TASK`/`BUG` (mesma regra de `TASK`/`BUG` em `validateHierarchy`), sem filhos.
- **Edição de tipo:** `updateItemSchema` passa a aceitar `TASK | BUG | EXTERNAL`; a troca de tipo continua restrita a cards folha.
- Alternativas: manter `EXTERNAL` fora do Kanban (rejeitada — precisa ser visível e selecionável como alvo); modelar como flag em vez de tipo (rejeitada — T47 pede um tipo distinto e o padrão do domínio é `type`).

### 2. Dependências apontam para qualquer tipo, incluindo `EXTERNAL` (T51)
Nenhuma mudança estrutural em `item_dependencies`: a validação de alvo já aceita qualquer item. Ajustes são: garantir que a criação de `EXTERNAL` gere item folha válido (Decisão 1), que a checagem de ciclo e o cascade tratem `EXTERNAL` como qualquer nó, e que o payload/`ItemDependenciesArea` exibam o tipo `Dep. Externa`. A unicidade `(tenant_id, item_id, depends_on_item_id)` e a regra de auto-dependência permanecem.

### 3. Cross-project via `depends_on_project_id` e validação de acesso (T50)
Adicionar à tabela `item_dependencies` a coluna `depends_on_project_id` (nullable/derivada; NOT NULL quando o alvo for cross-project), mantendo a origem atrelada ao `project_id` atual. A rota:

1. resolve o projeto do alvo e confirma acesso do usuário (membership/grupo global, respeitando projetos restritos/ocultos);
2. busca o item alvo por `(tenant_id, depends_on_project_id)`;
3. mantém a checagem de ciclo **por conjunto de arestas do tenant** (o grafo pode atravessar projetos quando permitido).

O payload do item dependido passa a incluir `projectId`/`projectName` do alvo. A auditoria de integridade (`db/integrity.ts`) ganha checagem de coerência entre `depends_on_project_id` e o projeto real do alvo.

- Alternativas: manter cross-project desabilitado por padrão e exigir flag por projeto (mais seguro, porém T50 pede a relação como recurso); reusar `project_id` para o projeto do alvo (rejeitada — perderia o vínculo da origem).

### 4. Recálculo explícito de datas por ordem topológica (T48)
O recálculo é uma **ação explícita** (botão na UI + endpoint dedicado + opcionalmente ferramenta), nunca automático. Modelo:

- **Duração:** `duração = dueDate − startDate` quando ambas existem; item com só uma data é marco (duração 0) ancorado nessa data; item sem datas é ignorado como âncora.
- **Ancoragem por tipo** (predecessor `P`, sucessor `S`, lag `L`):
  - `FS`: `start(S) ≥ dueDate(P) + L`
  - `SS`: `start(S) ≥ start(P) + L`
  - `FF`: `dueDate(S) ≥ dueDate(P) + L`
  - `SF`: `dueDate(S) ≥ start(P) + L`
- **Ordem:** processar em ordem topológica (grafo acíclico garantido pelo T46).
- **Itens concluídos:** pinados (não recalculados, servem de âncora).
- **Resultado:** resumo com a quantidade de itens alterados; no-op quando não há dependências.

Alternativas: recalcular a cada edição (rejeitada — T48 pede explicitamente o botão por custo); criar um motor de cronograma em pacote separado (adiado — primeiro a versão no domínio da API, extraível depois).

### 5. Caminho crítico derivado, exibido por toggle (T49)
Calcular o caminho crítico como dado **derivado** do grafo + durações/lag (cadeia de maior duração), sem persistir. Expor via endpoint/serviço de projeto e sinalizar os itens na UI por um toggle global, disponível apenas quando há dependências. A consulta é somente leitura.

- Alternativas: persistir um flag `isCritical` (rejeitada — fica obsoleto a cada mudança do grafo e exige recálculo em cascata).

### 6. Ferramentas de dependência no catálogo único (T52)
Adicionar quatro ferramentas (`list_item_dependencies`, `create_item_dependency`, `update_item_dependency`, `delete_item_dependency`) ao descritor único em `packages/tool-registry` (`fields.ts`, `registry.ts`, `validation.ts`, `policies.ts`) com policies `VIEWER` (leitura) e `MEMBER` (escrita), e dispatch em `packages/tool-execution/src/{registry,http-adapter}.ts` mapeando para os endpoints existentes. Documentar em `apps/mcp/README.md` e na skill azyboard. O Azy Agent não precisa de allow-list nova: herda o catálogo.

- Alternativas: expor apenas leitura (rejeitada — T52 pede CRUD para o agente editar o grafo).

### 7. Provedor de autenticação na instalação, OAuth/OIDC sobre provedores fixos (T45)
Uma função `resolveAuthConfig` (junto de `resolveInstallProfile`/`services/auth.ts`) lê `AZYBOARD_AUTH_PROVIDER` (`LOCAL` padrão | `MICROSOFT` | `GOOGLE`) e as credenciais de cliente; falha na inicialização quando o provedor integrado não tem credenciais. O método é **permanente por instalação**, sem migrations de conversão.

- **Descoberta:** novo endpoint público `GET /auth/providers` (sem sessão) devolvendo `{ provider }` e a URL de início; nunca segredos.
- **Fluxo:** `GET /auth/oauth/:provider/start` (authorization code + PKCE, `state` em cookie curto assinado) e `GET /auth/oauth/:provider/callback` (valida `state`, troca o code, verifica o `id_token`) resolvem o e-mail canônico verificado.
- **Identidade:** vincula por e-mail canônico a um usuário existente; **sem auto-provisionamento** e sem cruzar tenants. Novas colunas em `users` (`external_idp`, `external_subject`, únicos por par; `passwordHash` permanece para o modo local). Tentativas integram a auditoria de login existente (`loginAttempts`).
- **Sessão:** idêntica ao login local (`signJwt` HS256 + cookie `SESSION_COOKIE`). O `tenant_id` é derivado da identidade resolvida.
- **Login local:** desabilitado (rota recusa senha) quando o provedor não é `LOCAL`; API Keys de agentes não são afetadas.
- **Frontend:** `AuthContext`/`LoginPage` consultam `/auth/providers` e renderizam apenas os controles do provedor; i18n para os botões.
- Alternativas: OIDC genérico configurável (mais flexível, porém T45 nomeia Microsoft e Google); armazenar provedor por usuário em vez de por instalação (rejeitada — T45 é decisão de instalação).

### 8. Encerramento e rastreabilidade
Cada card do Azy Board é referenciado no `proposal.md` (`Board ref`). A change cobre T47, T48, T49, T50, T51, T52 e T45; ao concluir a implementação, cada card correspondente deve ser fechado com `complete_task` e confirmado no board.

## Risks / Trade-offs

- **Divergência de enums por tipo** (adicionar `EXTERNAL` em ~10 arquivos): esquecer um ponto gera comportamento inconsistente → centralizar via `ItemType`/`isWorkCard` e cobrir com testes de contrato e de catálogo; os gates `test:mcp-catalog`/`check:agent-skill` sinalizam omissões nas ferramentas.
- **Ciclo cross-project mais caro** (grafo atravessa projetos): varredura precisa considerar o tenant inteiro → limitar a leitura ao tenant e revalidar acesso; manter detecção em memória sobre `listByProject`+`listByProject` do alvo.
- **Recálculo com datas incompletas** pode produzir resultados inesperados → documentar a regra de marco/duração, ignorar itens sem âncora e devolver resumo do que mudou.
- **Caminho crítico dependente de durações implícitas**: itens sem `startDate`/`dueDate` distorcem o cálculo → sinalizar no resultado que itens sem datas foram ignorados.
- **OAuth amplia a superfície de segurança**: `state`/PKCE e verificação de `id_token` são obrigatórios → reaproveitar auditoria e rate limit existentes; recusar e-mails desconhecidos sem revelar contas.
- **Bloqueio do login local** em modo integrado pode trancar o administrador se as credenciais OAuth falharem → validar credenciais na inicialização (falha cedo) e manter documentação de instalação clara.

## Migration Plan

1. **Schema:** migrations SQLite e PostgreSQL para (a) CHECK de `items.type` com `EXTERNAL`, (b) `item_dependencies.depends_on_project_id`, (c) colunas de identidade externa em `users`; atualizar snapshots/journal e marcadores de instalação; paridade via `postgres/parity.test.ts`.
2. **Config:** introduzir `AZYBOARD_AUTH_PROVIDER` e credenciais; default `LOCAL` preserva instalações existentes. Documentar em instalação/`README`.
3. **Rollback:** reverter não é feito em runtime (provedor é permanente); a mudança de provedor exige reinstalação/configuração, alinhado ao modelo de perfis de instalação. As migrations são aditivas (colunas/CHECK), permitindo rollback de código antes de reverter o banco.
4. **Cronograma:** endpoints/serviço novos são aditivos; recálculo é opt-in pelo botão, sem alterar dados existentes até o usuário acionar.

## Open Questions

- Tratamento visual exato dos itens do caminho crítico (cor de borda vs. chip) — pode ser definido na implementação sem alterar specs ou tasks.
- Se itens `EXTERNAL` devem permitir responsável interno — decidido como sim (mesmo formulário da task); ajuste fino de UI é deferível.
