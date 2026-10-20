# Design

## Context

Ver `proposal.md` — Why. Estado atual relevante:

- `apps/web/src/features/project-settings/hooks/useProjectSettingsData.ts` carrega
  `GET /projects/:id/member-candidates` com `useQuery` no nível da tela de Settings,
  **sem** busca nem paginação, sempre que o usuário administra o projeto.
- `GET /projects/:id/member-candidates` (`apps/api/src/routes/projects.ts`) chama
  `persistence.identity.listUsers()` (todos os usuários do tenant) e
  `listProjectMembers()` no servidor, cruza os dois em memória e devolve um array com
  `isMember`.
- `MemberDialog.tsx` filtra o array inteiro no cliente (`filterMemberCandidates`), permite
  selecionar **uma** pessoa e envia um único `POST /projects/:id/members`.
- A API já tem uma convenção de paginação consolidada em `GET /projects/:id/items`
  (`apps/api/src/routes/items.ts`): envelope `{ data, page, limit, total, hasMore,
  nextCursor }`, cursor base64url do offset, `limit` padrão 50 com teto de 100.
- `apps/api/src/db/sqlite/adapter.ts` expõe `runSqliteAtomic` e já emite eventos de
  metadados (`emitMetadataEvent(..., 'members' | 'squads')`) a cada mutação de membership.
- O `POST /projects/:id/members` atual **não** usa o journal de mutações
  (`runMetadataMutation`); valida squad, resolve usuário no tenant, rejeita duplicata e
  chama `persistence.projects.addProjectMember`.

## Goals / Non-Goals

**Goals:**

- Montar o time inteiro em uma única interação: grade compacta, seleção múltipla,
  confirmação única.
- Escalar para milhares de usuários: busca e paginação no servidor, sem trazer a lista
  inteira do tenant para o cliente.
- Reusar as convenções existentes de paginação, eventos de metadados e i18n.
- Adição em lote eficiente: uma requisição, uma transação, validação em massa.

**Non-Goals:**

- Alterar o dialog de **edição** de membro (permanece como está).
- Alterar o `POST /projects/:id/members` individual (continua sendo o caminho de um
  membro por vez e o usado por MCP/`add_member`).
- Traduzir/ignorar acentos **na ordenação**? Sim (ver decisão 2): a ordem normaliza acentos
  para manter a leitura pt-BR que a lista tinha no cliente.
- Seleção em massa por "selecionar todos os resultados do filtro" (não pedido; evita
  selecionar acidentalmente milhares de pessoas).
- Alterar o modelo de dados (`memberships`, `squads` e `users` ficam como estão).

## Decisions

### 1. Paginação por cursor com o envelope já usado em `/items`

`GET /projects/:id/member-candidates` passa a aceitar `q`, `page`, `limit` e `cursor` e a
responder `{ data, page, limit, total, hasMore, nextCursor }`, com `limit` padrão 50 e teto
de 100 e cursor base64url do offset — exatamente o contrato de `GET /projects/:id/items`.

*Por quê*: um único padrão de paginação no projeto; o cliente já sabe consumir esse
envelope (`BoardItemsPage` em `useBoardData.ts`). *Alternativas*: paginação numerada
(descartada pelo usuário); cursor opaco por chave (`(name, id)`) — mais correto sob
inserções concorrentes, mas diverge do padrão do projeto e o ganho é irrelevante para uma
lista de pessoas que muda pouco durante a edição do time.

### 2. Filtragem no servidor e recorte de elegíveis por parâmetro

O filtro por nome/e-mail passa a ser resolvido na camada de persistência, com uma nova
porta `projects.listMemberCandidates(context, projectId, { q, eligibleOnly, limit, offset })`
devolvendo `{ items, total }`. O `total` sai de uma contagem com os mesmos critérios. O
recorte de elegíveis (`eligibleOnly`) exclui na consulta os usuários que já possuem
membership no projeto — é o modo usado pela grade.

A comparação de nome é feita por uma **chave normalizada compartilhada** pelos dois drivers
(`apps/api/src/db/nameNormalization.ts`): um `replace()` aninhado que dobra os acentos do
português (maiúsculas e minúsculas) seguido de `lower()`, gerado uma vez por coluna. A mesma
dobra é aplicada em JS ao termo digitado antes de virar padrão `LIKE`, com `ESCAPE '\'` para
que `%` e `_` do termo sejam literais.

*Por quê*: hoje o cruzamento em memória exige carregar todos os usuários do tenant e todas
as memberships do projeto — o gargalo descrito na proposta. A chave normalizada resolve dois
problemas de uma vez: (a) a **ordem** precisa ser estável entre páginas e nem o `lower()` do
SQLite (ASCII-only) nem a collation do PostgreSQL garantem ordem pt-BR, onde "Álvaro" anda
junto de "Ana" em vez de ir para o fim da lista; (b) a **busca** não pode regredir em relação
ao filtro anterior, que normalizava com `toLocaleLowerCase('pt-BR')` — sem dobrar acentos,
procurar "alvaro" deixaria de encontrar "Álvaro" no SQLite. *Alternativas*: `ORDER BY name`
cru (acentuadas iriam para o fim, regressão visível em nomes brasileiros); collation pt-BR
registrada no banco (o `bun:sqlite` não expõe registro de collation e o PostgreSQL depende da
collation do servidor, então a ordem divergiria entre perfis); ordenar no cliente (impossível
com paginação no banco).

### 3. Manter `isMember` na resposta e omitir membros via `eligibleOnly`

O payload de candidatos continua trazendo `isMember`; a grade sempre pede
`eligibleOnly=true`, de modo que a exclusão acontece no servidor. A corrida "alguém
adicionou a pessoa enquanto o dialog estava aberto" é resolvida pelo resultado por item da
adição em lote (ver decisão 4).

*Por quê*: preserva o contrato existente do endpoint (nenhuma quebra para outros
chamadores) e mantém o significado do indicador para quem pedir a listagem completa, sem
custo relevante — o filtro é a mesma cláusula que já é usada para calcular o recorte.
*Alternativa*: remover `isMember` e sempre excluir membros — contrato mais enxuto, mas
quebra o endpoint sem necessidade e elimina uma informação que a especificação já promete.

### 4. `POST /projects/:id/members/batch` com resultado por item

Corpo `{ members: [{ userId, role, squadId?: string | null }] }`, no máximo 200 entradas e
no mínimo 1 (schema Zod; lista vazia → 400). Fluxo no handler:

1. Coleta os `userId` distintos e confirma, em uma consulta, quais existem **no tenant**
   ativo (mesma checagem do endpoint individual; `[TENANT]`).
2. Coleta os `squadId` distintos e confirma que pertencem ao **projeto**.
3. Coleta as memberships existentes desses usuários no projeto.
4. Chama uma nova porta `projects.addProjectMembers(context, projectId, inputs)` que
   insere todas as entradas válidas em **uma única transação** (`runSqliteAtomic` /
   transação do PostgreSQL) e emite os eventos `members` e `squads` uma vez.
5. Responde 200 com `{ created: [...], skipped: [{ userId, reason: 'ALREADY_MEMBER' }],
   invalid: [{ userId, reason: 'USER_NOT_IN_TENANT' | 'SQUAD_NOT_IN_PROJECT' }] }`.

*Por quê*: sem transação, uma falha no meio de 30 adições deixa o time pela metade; e o
resultado por item dá à UI a mensagem certa sem abortar o lote inteiro por causa de uma
pessoa. *Alternativas*: `N` chamadas ao endpoint individual (sem atomicidade, `N`
round-trips, sem resumo consolidado); tudo-ou-nada com erro global (uma pessoa já membro
derrubaria a seleção inteira). O endpoint é naturalmente idempotente — repetir a mesma
requisição devolve tudo como `skipped` — então não entra no journal de mutações, mantendo a
consistência com o `POST /members` atual.

### 5. Carga dos candidatos passa a ser preguiçosa e vive no dialog

`memberCandidates` sai de `useProjectSettingsData` (que roda junto com a tela de Settings)
e passa a ser buscada por um hook próprio usado apenas enquanto o dialog de adição está
aberto, com `useInfiniteQuery` do TanStack Query v5. A chave é o prefixo já existente
`queryKeys.settings(userId, projectId, 'memberCandidates')` com o termo acrescentado como
segmento extra, de modo que `invalidate('members')` continue invalidando todas as páginas.

*Por quê*: a busca só faz sentido com o dialog aberto; carregar candidatos ao abrir
Settings era justamente o desperdício atual, e `useInfiniteQuery` dá `fetchNextPage`,
`hasNextPage` e o acumulado sem estado manual. *Alternativas*: manter em
`useProjectSettingsData` com `useQuery` por página e acumular em `useState` (mais código
para o mesmo resultado); buscar tudo de uma vez no primeiro termo (contraria o requisito de
escala).

### 6. Grade compacta com defaults calculados a partir dos squads

Tabela com cabeçalho fixo e colunas `checkbox | Nome | E-mail | Squad | Papel`. O default
de squad por linha é derivado de `squads.length`: `1` → o id do único squad; `0` ou `>1` →
vazio. O papel inicial é `MEMBER`. Cada linha guarda `{ selected, role, squadId }` em um
`Map` por `userId`, preservado entre páginas carregadas.

*Por quê*: atende exatamente a regra pedida e mantém papel/squad editáveis por linha.
*Alternativa*: selects de squad/papel globais no rodapé aplicados em massa — menos clicável
para times heterogêneos e não foi o que o usuário descreveu.

### 7. Carregamento sob demanda com botão + sentinela

O fim da lista mostra um controle "Carregar mais" que também é acionado
automaticamente quando um sentinela entra na viewport (`IntersectionObserver`). O botão
permanece visível e focável como caminho acessível e testável.

*Por quê*: scroll infinito sem botão é inacessível por teclado e difícil de testar; manter
os dois custa pouco. *Alternativa*: só `IntersectionObserver` (descartada pelos motivos
acima).

### 8. Busca com debounce e reinício de página

O termo digitado é debounced (~250 ms) antes de virar parâmetro da consulta; ao mudar, a
lista volta à primeira página e o scroll ao topo. Seleções já feitas **não** são
descartadas por mudança de filtro (o contador de selecionados continua refletindo pessoas
que podem não estar na página visível).

*Por quê*: evita uma requisição por tecla em listas de milhares de registros, e perder a
seleção ao digitar no filtro seria hostil. *Alternativa*: limpar a seleção ao filtrar —
mais simples, mas quebra o fluxo "buscar João, buscar Maria, confirmar as duas".

## Risks / Trade-offs

- [`limit`/`total` com milhares de linhas encarece a contagem a cada página] → o `total` é
  calculado uma vez por consulta com os mesmos critérios; o custo é aceitável em SQLite e
  PostgreSQL para dezenas de milhares de usuários. Se virar gargalo, a paginação por cursor
  permite remover `total` sem mudar o cliente (o cliente usa `hasMore`).
- [`LIKE` do SQLite só é case-insensitive para ASCII] → a busca usa a chave normalizada
  (dobra de acentos + `lower()`) dos dois lados, igual nos dois drivers, mantendo — e não
  perdendo — o comportamento do filtro cliente anterior. A ordem passa a ser
  "acento-insensível, por nome" em vez de collation pt-BR exata: diferenças residuais ficam
  restritas a casos que o dobrador não cobre (ex.: hífen e espaço).
- [Dobrar acentos no SQL custa uma expressão longa por linha] → a expressão é gerada uma
  única vez por coluna e cacheada; o custo é o de um `LIKE`/`ORDER BY` sobre a tabela de
  usuários do tenant, que é pequena comparada ao volume de itens do board.
- [Seleção preservada entre filtros pode levar a confirmar uma pessoa que saiu da tela] →
  o rodapé mostra o contador de selecionados e a confirmação lista o resultado por item
  (criados / já membros / inválidos), então o usuário vê exatamente o que aconteceu.
- [`eligibleOnly` é sempre verdadeiro no único consumidor atual, então o ramo "listagem
  completa" só é exercido por testes] → o parâmetro é o que preserva o contrato existente do
  endpoint; os testes de integração cobrem os dois modos para que ele não apodreça.
- [Lote de 200 adições em uma transação pode segurar lock] → teto de 200 entradas por
  requisição e inserção em massa (sem N+1), com validações feitas antes da transação.
- [Realtime: alguém adiciona a mesma pessoa durante o diálogo] → o evento `members`
  invalida a consulta de candidatos, removendo a linha; se a confirmação chegar antes, a
  entrada volta como `skipped`/`ALREADY_MEMBER` e é reportada ao usuário.
- [Duas pessoas administrando o time ao mesmo tempo podem enviar lotes concorrentes] →
  entradas duplicadas são descartadas pela checagem de membership dentro da transação, sem
  violar unicidade.

## Migration Plan

1. API primeiro (aditivo): porta + handler do lote, depois a busca/paginação dos
   candidatos. Não há migração de banco — nenhuma tabela ou coluna muda.
2. Web junto: o dialog novo só funciona contra o endpoint novo, então web e API sobem no
   mesmo deploy (o projeto já usa imagem única).
3. Rollback: reverter o deploy devolve a versão anterior de ambos. Nenhum dado gravado pelo
   lote precisa ser desfeito — são memberships comuns, removíveis pela UI existente.
4. Sem feature flag: a mudança é de UI interna das configurações de projeto.

## Open Questions

- Expor a adição em lote ao MCP/agentes (uma tool `add_members` em vez de `add_member` em
  loop) fica para um change próprio; nada na API atual impede isso depois.
