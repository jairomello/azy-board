# Análise Completa do Sistema Azy Board

**Data:** 2026-09-11

## Diagnóstico Geral

O sistema tem uma base funcional boa para um produto em evolução: TypeScript estrito, isolamento por tenant aplicado em muitas consultas, transações em operações importantes, testes de integração razoáveis, migrations versionadas, API Keys com escopos e uma preocupação real com auditoria.

O problema principal não é falta de funcionalidades. É que o sistema cresceu mais rapidamente do que sua arquitetura. Hoje ele funciona como um MVP avançado, mas ainda não possui algumas garantias necessárias para ser considerado maduro em produção: atomicidade completa, validação sistemática, concorrência segura, escalabilidade horizontal, observabilidade e CI obrigatório.

A recomendação não seria uma reescrita completa. Seria uma refatoração evolutiva para um **monólito modular**, preservando a API e o banco enquanto se extraem responsabilidades por domínio.

---

## Mais Urgente

### 1. Autorização de anexos permite acesso excessivo

A rota de arquivos valida apenas se o primeiro segmento do caminho corresponde ao tenant do usuário:

- `apps/api/src/index.ts:67-81`

Ela não valida se o usuário participa do projeto ao qual o item pertence. Um usuário autenticado do mesmo tenant que obtiver a URL pode acessar um anexo de um projeto restrito.

Além disso, qualquer tipo MIME pode ser enviado e servido na mesma origem:

- `apps/api/src/routes/attachments.ts:27-58`
- `apps/api/src/index.ts:78-81`

Isso cria risco de conteúdo HTML/SVG malicioso ser renderizado como conteúdo da aplicação.

**Correção prioritária:**
- Servir anexos por uma rota com `attachmentId`.
- Consultar anexo, item, projeto, tenant e membership.
- Usar `Content-Disposition: attachment` para tipos não confiáveis.
- Permitir apenas tipos MIME aprovados.
- Migrar para storage de objetos com URLs temporárias.
- Testar acesso entre projetos restritos do mesmo tenant.

### 2. Reparenting pode corromper `ancestryPath`

Ao alterar o pai de um item, os descendentes são atualizados antes da transação que efetivamente muda o item:

- `apps/api/src/routes/items.ts:906-936`
- `apps/api/src/services/ancestry.ts:25-45`

Consequências possíveis:
- Descendentes mantêm o caminho antigo.
- Falha parcial deixa a árvore inconsistente.
- O evento de analytics pode representar um estado diferente do estado persistido.

Também não há uma validação completa contra ciclos na rota individual. Um item pode potencialmente ser ligado a um descendente, enquanto a operação em lote possui detecção explícita de ciclos:

- Rota individual: `apps/api/src/routes/items.ts:850-915`
- Operação em lote: `apps/api/src/routes/batch.ts:251-274`

**Correção prioritária:**
- Implementar `moveItem()` como caso de uso transacional.
- Validar ciclo e profundidade antes da escrita.
- Atualizar item e descendentes dentro da mesma transação.
- Preferencialmente usar uma CTE recursiva em PostgreSQL.
- Criar teste de reparenting com três ou mais níveis.

### 3. Operações concorrentes não são atômicas

O `claim` primeiro lê o item e depois o atualiza sem uma condição `assignee_id IS NULL`:

- `apps/api/src/routes/items.ts:742-756`

Duas requisições concorrentes podem observar o item livre e ambas receber sucesso, com a última sobrescrevendo a primeira.

O mesmo padrão aparece em:
- Cálculo de próxima posição.
- Contagem de runs do agente.
- Limites de orçamento.
- Geração de sequências de eventos.
- Aprovações e mudanças de estado do agente.

Exemplos:
- `apps/api/src/routes/checklists.ts:76-89`
- `apps/api/src/routes/assistant.ts:163-175`
- `apps/api/src/routes/assistant.ts:470-489`
- `apps/api/src/services/analytics.ts:31-43`

**Correção prioritária:**
- Usar updates condicionais e verificar `rowsAffected`.
- Criar constraints e índices únicos para representar invariantes.
- Usar locks transacionais ou advisory locks no PostgreSQL.
- Tornar as transições do agente uma máquina de estados persistida.

### 4. A execução do Azy Agent vive dentro do processo HTTP

A execução começa com:

- `void harness.run(...)` em `apps/api/src/routes/assistant.ts:495-497`

Se o processo reiniciar:
- A execução é perdida.
- O cliente pode continuar vendo `QUEUED` ou `RUNNING`.
- A recuperação só acontece quando outra mensagem dispara a expiração de runs antigas.
- Não há retry confiável ou garantia de execução única.

Os limites também não são seguros em múltiplas instâncias:

- Rate limit em `Map`: `apps/api/src/routes/assistant.ts:74`
- Contagem e orçamento via leitura seguida de escrita: `apps/api/src/routes/assistant.ts:157-175`
- WebSocket em memória: `apps/api/src/services/websocket.ts:6`

**Correção prioritária:**
- Criar fila persistente de jobs.
- Separar worker do processo HTTP.
- Usar Redis ou PostgreSQL para locks, rate limiting e coordenação.
- Implementar heartbeat/lease do worker.
- Tornar execução, aprovação e cancelamento idempotentes.

### 5. Falta CI obrigatório

Não existe workflow em `.github/workflows`.

O comando `lint` não executa ESLint ou Biome; apenas repete o typecheck:

- `scripts/lint.ts:1-3`

Hoje o sistema depende de alguém lembrar de executar localmente:
- Typecheck.
- Testes.
- Build.
- Verificação de i18n.
- Testes de migrations.
- Catálogo MCP.

Isso é especialmente arriscado porque API, Web, MCP, wiki e OpenSpec precisam permanecer sincronizados.

**Correção prioritária:**
- Criar CI para toda branch e pull request.
- Executar `bun run check`.
- Adicionar lint real.
- Adicionar cobertura mínima.
- Executar migration test e smoke test.
- Bloquear merge quando contratos MCP, types ou i18n divergirem.

---

## Arquitetura Backend

### 6. Rotas acumulam regras de negócio, persistência e integração

Os maiores arquivos são:

| Arquivo | Linhas |
|---|---:|
| `apps/api/src/routes/items.ts` | 1.469 |
| `apps/api/src/routes/projects.ts` | 1.078 |
| `apps/api/src/routes/assistant.ts` | 650 |
| `apps/api/src/routes/batch.ts` | 419 |

Esses arquivos fazem simultaneamente:
- Parsing de HTTP.
- Autorização.
- Validação.
- Regras de hierarquia.
- Queries.
- Transações.
- Auditoria.
- Analytics.
- Idempotência.
- Broadcast WebSocket.
- Formatação de respostas.

Isso torna muito difícil provar que uma mutação é atômica. Um exemplo é a edição de item:

- Update principal e analytics em uma transação: `items.ts:919-936`.
- Atualização de descendentes fora da transação: `items.ts:906-915` e `938-941`.
- Log de auditoria depois da transação: `items.ts:943-958`.
- Broadcast depois disso: `items.ts:961`.
- Idempotência de criação salva depois da mutação: `items.ts:674`.

Uma falha no log ou na gravação de idempotência pode fazer a API retornar erro mesmo com a mutação já confirmada.

**Refatoração recomendada:**

```text
modules/
  items/
    domain/
    application/
      create-item.ts
      update-item.ts
      move-item.ts
      claim-item.ts
      delete-item.ts
    infrastructure/
      item-repository.ts
    http/
      item-routes.ts
```

O handler HTTP deveria apenas:
1. Validar input.
2. Criar contexto.
3. Executar caso de uso.
4. Mapear resultado para HTTP.

### 7. Validação de entrada é manual e inconsistente

Há 55 usos de `c.req.json<T>()`, mas o tipo genérico não valida dados em runtime.

Exemplos:
- `apps/api/src/routes/items.ts:791-814`
- `apps/api/src/routes/projects.ts:181`
- `apps/api/src/routes/apiKeys.ts:90`
- `apps/api/src/routes/checklists.ts:101`

Algumas rotas validam campos cuidadosamente, outras aceitam valores sem limites. O banco SQLite também não transforma os enums TypeScript em garantias suficientes de domínio.

**Refatoração recomendada:**
- Adotar Zod, Valibot ou schemas nativos do Hono.
- Definir schemas compartilhados para request e response.
- Rejeitar campos desconhecidos.
- Padronizar tamanho máximo, datas, números e enums.
- Gerar OpenAPI a partir desses schemas.

### 8. Contrato de erro não é único

Rotas retornam formatos diferentes:

```json
{ "error": "..." }
```

```json
{ "error": "...", "code": "...", "retryable": false }
```

Para agentes, o middleware transforma a resposta novamente:

- `apps/api/src/middleware/agentResponse.ts:9-35`

Isso cria dois contratos paralelos para a mesma API.

**Refatoração recomendada:**

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Projeto não encontrado",
    "retryable": false,
    "details": null
  }
}
```

O mesmo formato deveria valer para navegador, MCP e Azy Agent.

### 9. Separação SQLite/PostgreSQL é ilusória

O README afirma SQLite em desenvolvimento e PostgreSQL em produção:

- `README.md:176-185`

Mas o deploy documentado usa SQLite em produção:

- `DEPLOY.md:48-54`

A troca não está isolada "apenas em uma linha", apesar do comentário em:

- `apps/api/src/db/index.ts:5-18`

Existem dependências SQLite em:
- Imports do driver.
- Migrations.
- PRAGMAs.
- Tipos do schema.
- SQL específico.
- Estratégia de concorrência.
- Testes.
- Scripts de deploy.

**Decisão necessária:**
- Se o produto permanecer pequeno e single-instance, assumir oficialmente SQLite e trabalhar com suas limitações.
- Se o objetivo é multiusuário, alta concorrência e múltiplas instâncias, migrar para PostgreSQL agora.

Para a maturidade desejada, a escolha recomendada é PostgreSQL.

### 10. Integridade depende excessivamente da aplicação

O schema não representa várias invariantes:

- `items.parentId` não possui FK: `schema.ts:339-346`.
- `managerUserId` e `simpleStoryId` não possuem FK.
- Muitas relações não incluem tenant no próprio vínculo.
- `item_tags` não tem chave primária ou unique: `schema.ts:443-449`.
- `memberships` não possui unique visível para tenant/projeto/usuário: `schema.ts:261-269`.
- Usuários não possuem unique por tenant/e-mail: `schema.ts:22-37`.
- Entidades filhas podem tecnicamente referenciar registros de outro tenant se uma rota ou script falhar.

Isso faz do filtro `tenantId` em cada query a única linha de defesa.

**Refatoração recomendada:**
- Chaves compostas envolvendo tenant quando aplicável.
- `UNIQUE (tenant_id, normalized_email)`.
- `UNIQUE (tenant_id, project_id, user_id)` em memberships.
- `PRIMARY KEY (item_id, tag_id)` e `(item_id, sprint_id)`.
- FK de hierarquia ou uma tabela própria de árvore.
- Constraints de datas e números.
- RLS no PostgreSQL como defesa adicional.

### 11. Timestamps padrão podem ficar congelados

Há vários defaults como:

```ts
default(new Date().toISOString())
```

Exemplos:
- `apps/api/src/db/schema.ts:15`
- `apps/api/src/db/schema.ts:36`
- `apps/api/src/db/schema.ts:223`

Esse valor é avaliado ao carregar/gerar o schema, não representa de forma robusta o horário de cada inserção.

**Correção:**
- Usar `CURRENT_TIMESTAMP`.
- Ou `$defaultFn(() => new Date().toISOString())`.
- Preferir tipos timestamp reais no PostgreSQL.

### 12. Exclusão manual é extensa e frágil

A exclusão de projeto precisa conhecer praticamente todas as tabelas:

- `apps/api/src/routes/projects.ts:364-410`

A exclusão de item também faz cascata manual:

- `apps/api/src/routes/items.ts:966-1015`

Isso é um sinal de modelagem incompleta. Toda nova tabela exige lembrar de atualizar a exclusão.

Além disso, o banco remove metadados de anexos, mas não remove necessariamente os arquivos físicos quando projeto ou item é excluído.

**Refatoração recomendada:**
- Definir política explícita de cascatas.
- Remover dependências pelo banco sempre que possível.
- Usar outbox/job para excluir objetos do storage após commit.
- Criar testes de integridade que verifiquem órfãos em todas as tabelas.

---

## Performance

### 13. Algoritmos do Dashboard não escalam

O Dashboard carrega todos os itens e todos os eventos do projeto e faz agregações em memória:

- `apps/api/src/routes/dashboard.ts:44-57`
- `apps/api/src/routes/dashboard.ts:76-84`
- `apps/api/src/routes/dashboard.ts:105-121`

Há padrões com complexidade crescente:
- Para cada item bloqueado, filtra todos os eventos.
- Para cada evento do burnup, recria um array com todo o estado.
- Aging filtra e faz múltiplos `JSON.parse` por item/evento.

Com histórico grande, o endpoint pode degradar rapidamente.

**Refatoração recomendada:**
- Projeções/materialized views.
- Tabelas agregadas diárias.
- Consultas SQL agregadas.
- Paginação e limites.
- Processamento incremental pelo outbox.
- Política de retenção/compactação para eventos.

### 14. Há N+1 em operações hierárquicas

Exemplos:
- Atualização recursiva de ancestry: `services/ancestry.ts:28-44`.
- Cálculo recursivo de folhas: `services/ancestry.ts:68-93`.
- Criação de ciclo consulta sprint e filho para cada item: `services/analytics.ts:69-80`.
- Exclusão faz uma consulta por nível/pai: `routes/items.ts:981-994`.

**Correção:**
- CTE recursiva no PostgreSQL.
- Carregar subárvore em uma consulta.
- Atualizações em lote.
- Índice em `items(tenant_id, project_id, parent_id)`.

### 15. Batch carrega relações de todos os tenants

A operação em lote filtra corretamente os itens principais, mas carrega integralmente:

- `item_sprints`: `apps/api/src/routes/batch.ts:134`
- `item_tags`: `apps/api/src/routes/batch.ts:135`

Isso aumenta uso de memória e enfraquece a disciplina de isolamento.

**Correção:**
- Fazer joins com os itens do projeto/tenant.
- Nunca carregar tabela global para filtrar em memória.

---

## Frontend

### 16. `BoardPage` e `SettingsPage` são god components

| Arquivo | Linhas |
|---|---:|
| `BoardPage.tsx` | 2.007 |
| `SettingsPage.tsx` | 1.511 |
| `ItemModal.tsx` | 675 |
| `AzyAgentDrawer.tsx` | 569 |
| `TreeViewPage.tsx` | 470 |

`BoardPage` mantém dezenas de estados, filtros, WebSocket, drag-and-drop, modais, carregamento de catálogos, agrupamento hierárquico e mutações.

- Estados: `BoardPage.tsx:145-227`
- Carga inicial com dez chamadas: `BoardPage.tsx:340-373`
- Tempo real: `BoardPage.tsx:375-431`
- Filtros e agrupamentos: `BoardPage.tsx:445-636`
- Mutações: `BoardPage.tsx:670-1027`

`SettingsPage` mantém estados e operações de dez áreas independentes:

- `SettingsPage.tsx:53-143`

**Refatoração recomendada:**

```text
features/board/
  api/
  model/
  hooks/
  components/
  BoardScreen.tsx

features/project-settings/
  columns/
  members/
  squads/
  modules/
  sprints/
  versions/
  planning/
```

Cada seção de Settings deveria ter seu próprio componente, hook e estado.

### 17. Não há camada consistente de cache e sincronização

Cada tela executa `api.get`, mantém seu próprio array e decide manualmente quando recarregar.

Consequências:
- Duplicação.
- Race condition quando `projectId` muda.
- Requisição antiga pode sobrescrever o estado do projeto novo.
- Falta cancelamento com `AbortController`.
- WebSocket e respostas HTTP podem chegar fora de ordem.
- Dados iguais são carregados repetidamente.

Exemplo:
- `BoardPage.tsx:340-373`
- `SettingsPage.tsx:148-172`
- `ProjectDashboardPage.tsx:28-36`

**Refatoração recomendada:**
- Adotar TanStack Query ou uma camada interna equivalente.
- Chaves de cache por tenant/projeto.
- Invalidação por eventos WebSocket.
- Cancelamento automático.
- Estado remoto separado do estado de UI.

### 18. Atualizações otimistas são inconsistentes

O título é alterado localmente, mas não é restaurado quando a API falha:

- `BoardPage.tsx:812-820`

Algumas operações fazem rollback, outras refetch, outras apenas mostram toast.

A edição de item faz duas mutações independentes:
1. Atualiza item.
2. Atualiza tags.

- `BoardPage.tsx:822-835`

Se a segunda falhar, o item já foi alterado, mas a UI apresenta erro geral.

**Correção:**
- Endpoint único para salvar item e relações.
- Ou transação coordenada no backend.
- Política uniforme de optimistic update/rollback.
- Versionamento do registro para detectar conflito.

### 19. Chamadas HTTP ignoram a camada comum

`SettingsPage` usa `fetch` diretamente:

- `SettingsPage.tsx:244-252`
- `SettingsPage.tsx:283-295`
- `SettingsPage.tsx:390-417`

Em `confirmDeleteColumn`, nem `res.ok` é verificado. A UI remove a coluna mesmo que o servidor retorne erro.

Essas chamadas também não recebem o tratamento uniforme de sessão expirada de `lib/api.ts`.

**Correção:**
- Toda chamada deve passar pelo cliente API.
- Suportar body em `DELETE`.
- Padronizar erro, retry, timeout e cancelamento.

### 20. WebSocket dá aparência de sincronização mais forte do que oferece

O hook apresenta estado `synced` assim que conecta:

- `apps/web/src/hooks/useWebSocket.ts:24-25`

Mas:
- Não existe replay de eventos.
- O Board não refaz carga após reconectar.
- Eventos ocorridos durante a desconexão são perdidos.
- `retryDelay` é uma variável local recriada a cada reconexão, portanto o backoff tende a voltar para um segundo: `useWebSocket.ts:24-41`.
- Nem todas as mutações possuem eventos completos.
- Alguns eventos antigos continuam no contrato.

A UI mostra "Sincronizado" e "Atualizações em tempo real":

- `apps/web/src/components/BoardContext.tsx:36-52`

Isso transmite uma garantia maior do que a implementação fornece.

**Correção:**
- Eventos com `sequence` por projeto.
- Cliente mantém último cursor.
- Reconexão solicita replay ou refetch.
- Heartbeat e detecção de conexão zumbi.
- Remover eventos legados.
- Estado visual "conectado" separado de "dados reconciliados".

### 21. Testes de frontend são majoritariamente testes de texto-fonte

Exemplos:

- `board-realtime-contract.test.ts:3-9`
- `item-modal-spacing-contract.test.ts:3-29`
- `project-visibility-contract.test.ts:3-79`

Eles verificam se determinada string existe no arquivo. Uma refatoração semanticamente correta pode quebrá-los, enquanto uma implementação incorreta pode passar apenas mantendo a string.

Não há jsdom, React Testing Library, Playwright ou Cypress.

**Correção:**
- Testes unitários de hooks/adapters.
- Testes de componentes com interação.
- Playwright para login, Board, drag, Settings, permissões e agente.
- Visual regression para telas principais.
- Manter testes de texto apenas para contratos muito específicos, não como base da UI.

### 22. i18n não está concluído

O verificador encontrou 27 possíveis textos fixos. Exemplos confirmados:

- `BoardPage.tsx:48-55`
- `BoardContext.tsx:23-24`
- `BoardContext.tsx:38-52`
- `App.tsx:21-35`

Além disso, `check:i18n` informa problemas, mas não falha o build.

**Correção:**
- Transformar o scanner em gate.
- Proibir texto localizado em JSX fora dos arquivos de idioma.
- Tipar chaves de tradução.

### 23. Bundle ainda é pesado

Build atual:

| Chunk | Tamanho |
|---|---:|
| `ProjectDashboardPage` | 448,77 KB |
| Chunk principal | 366,46 KB |
| Editor/Accordion | 339,53 KB |
| `BoardPage` | 192,75 KB |

O roteamento usa lazy loading, o que é positivo, mas Dashboard, gráficos e editor continuam pesados.

**Correção:**
- Lazy load de Recharts e Tiptap dentro das páginas.
- Importar apenas extensões utilizadas.
- Medir bundle com visualizer.
- Estabelecer orçamento de bundle no CI.

### 24. Error Boundary expõe stack na UI

`App.tsx` apresenta `err.stack` diretamente:

- `apps/web/src/App.tsx:21-28`

Em produção isso pode revelar detalhes internos.

**Correção:**
- Mensagem genérica em produção.
- Correlation ID.
- Stack somente no sistema de observabilidade.

---

## MCP e Contratos Compartilhados

### 25. O MCP contém grande quantidade de código morto

`apps/mcp/src/index.ts` possui 969 linhas.

- Definições antigas estão em `false ? [...]`: `index.ts:147-645`.
- Um `switch` inteiro está depois de um `return`: `index.ts:663-869`.
- Existe outra tabela manual de validação: `index.ts:885-956`.

Esse código não executa, mas continua parecendo autoritativo. Já contém regras antigas, como TASK órfã, que contradizem o comportamento atual.

**Correção imediata:**
- Remover todo o branch morto e switch inalcançável.
- Deixar `index.ts` apenas como adaptador de transporte.
- Tornar `registry.ts` a única fonte de ferramentas.
- Gerar schemas, validação e documentação a partir do registry.

### 26. API importa código-fonte interno do MCP

A API faz:

```ts
from '../../../mcp/src/registry.js'
```

- `apps/api/src/services/assistantTools.ts:1-14`

Mas `apps/api/package.json` não declara `@azy-board/mcp` como dependência.

Isso significa:
- API e MCP não são aplicações realmente independentes.
- Build depende da estrutura física do monorepo.
- Uma imagem Docker que copie somente `apps/api` pode falhar.
- O MCP, que deveria ser adaptador externo, virou fonte de domínio para a API.

**Arquitetura recomendada:**

```text
packages/
  domain/
  contracts/
  tool-registry/
apps/
  api/
  web/
  mcp/
  assistant-worker/
```

O registry compartilhado deve estar em `packages/tool-registry`, não dentro de uma aplicação.

### 27. `@azy-board/types` mistura domínio, transporte e UI

Tudo está em um arquivo de 366 linhas:

- Enums de domínio.
- JWT.
- RequestContext interno.
- Eventos WebSocket.
- Tipos do Dashboard.
- Funções de apresentação.
- Contratos do assistente.

Há drift concreto:

- `AssistantProvider` aceita somente `'OPENAI'`: `packages/types/src/index.ts:183`.
- Schema e backend aceitam `'OPENAI' | 'OPENROUTER'`: `apps/api/src/db/schema.ts:65`.

Também existem tipos duplicados localmente no frontend, como `ItemData`, `ProjectContext`, `Sprint` e `Column`.

**Correção:**
- `packages/domain`: tipos puros de negócio.
- `packages/api-contracts`: requests/responses.
- `packages/realtime-contracts`: eventos.
- `packages/assistant-contracts`: agente.
- Schemas runtime exportando também os tipos TypeScript.

---

## Segurança e Operação

### 28. Login não tem rate limiting

A rota pública de login não possui limitação:

- `apps/api/src/routes/auth.ts:15-35`

O único rate limit existente é o do assistente.

Também não há política mínima de senha ao criar usuário:

- `apps/api/src/routes/users.ts:39-53`

**Correção:**
- Rate limiting por IP e identidade.
- Delay progressivo.
- Política mínima de senha.
- Auditoria de tentativas.
- Opcionalmente MFA para Root/Admin.

### 29. Identidade multi-tenant é ambígua

O cadastro permite o mesmo e-mail em tenants diferentes:

- `users.ts:48-49`

Mas o login busca apenas por e-mail, sem tenant:

- `auth.ts:22-25`

Não há unique global nem unique por tenant no schema:

- `schema.ts:22-37`

Se dois tenants possuírem o mesmo e-mail, `findFirst` pode autenticar uma conta imprevisível.

**Correção urgente:**
- Escolher identidade global ou identidade por tenant.
- Para identidade global, separar `identities` de `tenant_users`.
- Para identidade por tenant, login precisa receber domínio/slug do tenant.
- Adicionar constraint correspondente no banco.
- Normalizar e-mail para lowercase.

### 30. Faltam headers e observabilidade

Não encontrei:
- CSP.
- `X-Frame-Options`/`frame-ancestors`.
- HSTS.
- Request IDs.
- Logs estruturados.
- Métricas.
- Tracing.
- Health/readiness endpoints.
- Error tracking.

O tratamento atual usa `console.error`:

- `apps/api/src/index.ts:32-35`

**Correção:**
- Middleware de request/correlation ID.
- Logs JSON com duração, rota, status, tenant anonimizado.
- `/health/live` e `/health/ready`.
- OpenTelemetry.
- Métricas de latência, erros, SQLite locks, filas e agente.
- Sentry ou equivalente no frontend/backend.

### 31. Deploy não é reproduzível pelo repositório

`DEPLOY.md` fala em containers, mas os Dockerfiles ficam em outro repositório/local:

- `DEPLOY_LABAPPS_LOCAL.md:103-115`

Isso cria drift entre aplicação e infraestrutura. Uma alteração em migrations, Bun, paths ou build pode depender de arquivos não revisados junto com o código.

**Correção:**
- Versionar Dockerfiles ou definir claramente um repositório de infraestrutura versionado e testado.
- Fixar versão do Bun.
- Executar build de imagem em CI.
- Rodar migration como job separado antes do rollout.
- Documentar rollback e compatibilidade entre versão da aplicação e schema.
- Automatizar backup e teste de restore.

---

## Estratégia de Desenvolvimento

### 32. O processo de especificação está maior que a capacidade de mantê-lo sincronizado

Há dezenas de OpenSpecs, README extenso, wiki com muitas páginas, CHANGELOG e documentação técnica paralela.

A auditoria recente encontrou dezenas de afirmações antigas. O README ainda contém alguns exemplos:
- Afirma PostgreSQL em produção, enquanto o deploy usa SQLite.
- Descreve CSV no Azy Agent, embora não esteja ligado à UI.
- Limites do Azy Agent divergem do código.
- Afirma que toda mutação de agente exige aprovação, mas MCP externo pode executar mutações diretamente.

O problema não é documentação insuficiente, mas **múltiplas fontes de verdade**.

**Estratégia recomendada:**
- Código/schema runtime como fonte de contratos.
- Gerar catálogo MCP e OpenAPI.
- Gerar tabelas de limites a partir de constantes compartilhadas.
- OpenSpec descreve decisão e comportamento, não replica detalhes voláteis.
- Wiki cobre uso do produto.
- README apresenta arquitetura e início rápido.
- Adicionar revisão de docs à definição de pronto.

---

## Como Reestruturar

### Arquitetura-alvo

Um monólito modular com quatro limites principais:

```text
packages/
  domain
  contracts
  tool-registry
  observability

apps/
  api
  web
  mcp
  assistant-worker
```

Domínios internos:

```text
identity
tenancy
projects
work-items
planning
attachments
activity
analytics
assistant
realtime
```

Cada domínio teria:
- Entidades e invariantes.
- Casos de uso.
- Portas/repositórios.
- Adaptadores de persistência.
- Adaptadores HTTP/MCP.
- Testes de domínio e integração.

### Fluxo de mutação recomendado

```text
HTTP ou MCP
  -> schema runtime
  -> autenticação
  -> autorização de caso de uso
  -> transação
       -> alteração de domínio
       -> auditoria
       -> analytics/outbox
       -> idempotência
  -> commit
  -> worker publica WebSocket e integrações
```

Isso elimina broadcasts antes/depois em pontos inconsistentes e garante que eventos não sejam perdidos quando a aplicação reinicia.

---

## Roteiro Priorizado

### Fase 0: Contenção de risco

Prazo sugerido: imediatamente.

1. Corrigir autorização e MIME dos anexos.
2. Corrigir reparenting e detecção de ciclos.
3. Tornar claim atômico.
4. Resolver ambiguidade de login multi-tenant.
5. Remover stack trace da UI em produção.
6. Criar CI obrigatório.
7. Criar backup automatizado e teste de restore.

### Fase 1: Garantias de domínio

1. Introduzir schemas runtime para toda API.
2. Padronizar erros.
3. Criar casos de uso para item, projeto e sprint.
4. Colocar mutação, auditoria, analytics e idempotência na mesma transação.
5. Reforçar constraints e índices.
6. Testar concorrência e isolamento multi-tenant.

### Fase 2: Banco e operação

1. Migrar para PostgreSQL.
2. Criar outbox transacional.
3. Separar worker do Azy Agent.
4. Adotar Redis/PostgreSQL para rate limit e locks.
5. Tornar WebSocket reconciliável.
6. Implementar health checks, logs e métricas.

### Fase 3: Frontend

1. Dividir `BoardPage`.
2. Dividir `SettingsPage` por seção.
3. Introduzir TanStack Query ou camada equivalente.
4. Remover `fetch` direto.
5. Uniformizar optimistic updates.
6. Adicionar testes de componentes e Playwright.
7. Finalizar i18n e orçamento de bundle.

### Fase 4: MCP e documentação

1. Remover código morto de `apps/mcp/src/index.ts`.
2. Extrair registry para package compartilhado.
3. Gerar validação e documentação das tools.
4. Dividir `@azy-board/types`.
5. Reduzir fontes documentais duplicadas.
6. Automatizar verificação de drift.

---

## Prioridade Final

Se houvesse capacidade para atacar somente cinco pontos, seriam:

1. **Segurança de anexos e identidade multi-tenant.**
2. **Integridade transacional da hierarquia e concorrência de claim.**
3. **PostgreSQL, constraints e outbox transacional.**
4. **Fila persistente para o Azy Agent e coordenação distribuída.**
5. **CI obrigatório com testes comportamentais reais.**

Depois disso refatorar `BoardPage`, `SettingsPage`, `items.ts`, `projects.ts` e o MCP. Dividir arquivos grandes sem resolver primeiro integridade, segurança e operação produziria código mais bonito, mas não um sistema mais estável.
