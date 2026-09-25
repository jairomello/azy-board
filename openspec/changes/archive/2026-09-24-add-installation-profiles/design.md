## Context

Board ref: 732e4f5b-872e-4a29-9958-d66ed0b43e0d (T1 + antigo Item 9). O card pede dois caminhos reais na **mesma codebase**, para instalações distintas: padrão leve, local e pequeno com SQLite/sem Redis; avançado com PostgreSQL e Redis ou equivalente comunitário. A escolha é definitiva no setup de cada instalação; o limiar aproximado de 20 pessoas é conselho de capacidade, não gatilho automático.

Hoje `apps/api/src/db/index.ts` instancia `bun:sqlite` na importação, `schema.ts` usa `sqlite-core` (871 linhas), `migrate.ts` aplica somente migrations SQLite e `drizzle.config.ts` usa `dialect: 'sqlite'`. Há SQL e auditoria específicos (`strftime`, PRAGMAs, BLOB, índices e tipos booleanos), testes com `:memory:` e outros processos com estado em memória (rate limit do agente, broadcast WebSocket). `apps/api/src/scripts/setup.ts` provisiona tenant/admin usando a conexão global; `DEPLOY.md` e `.env.example` descrevem SQLite. O perfil da instalação é diferente de `project.boardMode = SIMPLE | HIERARCHICAL`.

## Goals / Non-Goals

**Goals:**
- Preservar `bun run setup`/desenvolvimento sem banco externo e instalação pequena em SQLite sem Redis; selecionar `ADVANCED` explicitamente e demonstrar PostgreSQL + serviço Redis-compatível usados de fato.
- Manter os mesmos contratos REST, MCP, permissões, tenant, board, anexos, IDs e semântica de dados em ambos os bancos.
- Suportar instalações novas nos dois perfis, com setup e migrations de schema próprios; rejeitar mudança do perfil já registrado em uma instalação existente.
- Impedir config mista ou mudança acidental de banco, adicionar diagnóstico e matriz PostgreSQL/Redis em CI sem exigir esses serviços no check local padrão.

**Non-Goals:**
- `SIMPLE`/`HIERARCHICAL` do board, escolha automática por usuários, cobrança/licenciamento ou imposição de limite de 20 pessoas.
- Alta disponibilidade/múltiplas instâncias nesta entrega. Fila persistente/worker do agente (Item 4), orçamento/locks distribuídos e replay/reconciliação do board (Item 20) continuam com cards próprios. Não anunciar HA antes de implementá-los e testá-los.
- Storage S3, substituição do atual armazenamento de anexos (T3), otimização N+1 (Item 14), reorganização dos pacotes (Item 26/27) ou refatoração do deploy privado (Item 31).
- Migração de dados entre perfis em qualquer direção, assistente de exportação/importação, upgrade/cutover SQLite → PostgreSQL e rollback PostgreSQL → SQLite. Quem necessitar conservar os dados deverá conduzir um projeto de migração independente.

## Decisions

### 1. Perfil é configuração **por instalação**, validada antes de abrir conexões

Usar `AZYBOARD_INSTALL_PROFILE=SIMPLE|ADVANCED`, default `SIMPLE` quando ausente; `DATABASE_URL` continua apontando para arquivo SQLite no simples. `ADVANCED` exige URL PostgreSQL válida e `REDIS_URL` para um servidor compatível (Valkey comunitário/BSD como referência). Validar combinações e conectividade no bootstrap dos comandos da API, setup, migrations e jobs; rejeitar URL PostgreSQL sob SIMPLE, SQLite sob ADVANCED e credenciais ausentes. No primeiro setup, gerar identidade da instalação e guardar **dois marcadores associados** (`instanceId`, perfil, revisão): um em volume persistente da instância, fora da codebase/banco, e outro no banco novo. Ambos devem conferir antes de iniciar API/setup/migrations: apontar a mesma instância para outra URL, mesmo que aponte para banco vazio, não troca o perfil. Para SQLite legado sem marcadores, validar o banco existente e registrá-lo como SIMPLE sem reescrever dados do projeto; perda posterior do marcador local exige recuperação operacional explícita e verificada, nunca inferir uma nova instalação automaticamente. Migrations de schema só atualizam instalações no **mesmo** perfil. Não usar headcount como seletor. Alternativas: heurística pela URL (mudança acidental), marcador apenas no banco (contornável por URL nova) e flag no projeto (confunde instalação com modo de board).

### 2. Ports/repositórios tipados entre API e dialects

As rotas/serviços deixam de importar tabelas Drizzle ou `db` concreto diretamente. Definir ports internos em `apps/api/src/persistence/ports.ts`, modelos de persistência neutros em `apps/api/src/persistence/models.ts`, um `PersistenceContext` explícito (tenant e ator; resolução pré-auth é operação separada) e metadados de mutação explícitos (origem, correlação, tipo/fonte/identificação do ator). `UnitOfWork` é tipado por **comandos atômicos de domínio**, conforme decisão confirmada pelo usuário. Inclui criação/atualização com relações, reparenting, claim/release/move, arquivamento e exclusões, além de aplicação de um plano de batch já validado pelo domínio. Os handlers resolvem referências, regras, filtros e valores derivados antes de enviar o plano tipado; o adapter revalida escopo/versões necessárias e grava todas as alterações do plano no mesmo commit. Comandos preservam efeitos laterais do contrato atual: logs de atividade, eventos/rollups de analytics e inclusão dos anexos no outbox dentro da transação; a remoção física ocorre após commit. Exclusões recebem opção explícita para suprimir eventos em exclusões agregadas. Agrupar interfaces por domínio: identidade, projetos/equipe, itens/hierarquia, planning/checklists, arquivos, histórico/analytics e agente. Adaptadores ficam em `apps/api/src/db/sqlite/` e `apps/api/src/db/postgres/`; somente eles conhecem tabelas Drizzle, sessões, SQL e tipos físicos. Handlers mantêm autorização/regras de domínio, delegando persistência aos ports. Operações multi-tabela são métodos/comandos atômicos executados integralmente dentro do adapter; não expor callback assíncrono arbitrário a SQLite. Migrar primeiro o adapter SQLite e refatorar por fatias verticais com os testes existentes verdes; depois adicionar PostgreSQL sob os mesmos contracts. Alternativas: unificar SQLite e PostgreSQL com `as unknown as DrizzleDb` (rejeitada: compila mascarando incompatibilidade de tipo/runtime) ou duplicar todas as rotas por driver (rejeitada: drift de regras/RBAC/tenant).

### 3. Schemas e adapters físicos independentes

Manter schemas Drizzle por dialect e migrations/journals independentes: `sqlite-core` + bun-sqlite no SIMPLE, `pg-core` + driver PostgreSQL no ADVANCED. Os adapters implementam os mesmos ports e convertem tipos físicos para contratos de domínio comuns. Preservar IDs textuais, timestamps UTC ISO no contrato, FKs compostas por tenant, unicidades, CHECKs e semântica de exclusões. Mapear explicitamente booleanos, BLOB/`bytea`, SQL temporal, upserts, locks e resultados de `RETURNING`; não gerar migrations PG copiando SQL SQLite. A seleção do factory ocorre depois da validação dos marcadores e antes dos handlers atenderem tráfego.

### 4. Migrations e inspeção de integridade por dialect

Gerar migrations PostgreSQL no próprio repositório, com journal separado das SQLite append-only; validar base vazia e atualizações incrementais de **schema dentro de cada perfil**. Expor auditoria por port e manter implementação SQL própria por dialect; garantir equivalência de FK, `CHECK`, e-mail canônico global, timestamps, hierarquia, dados de agente e analytics/rollups. Rodar migrations/inspeção PG antes da aplicação ficar pronta; nunca reaproveitar SQL SQLite ou copiar seu journal para PG. Alternativa: deixar o ORM criar tabelas implicitamente em cada startup (drift e rollback imprevisíveis).

### 5. Redis tem função concreta, não é somente container decorativo

No avançado, usar adapter Redis-compatível para limitação transitória de requisições do agente (hoje `Map`) e transporte pub/sub do broadcast do board; simples mantém implementações locais e dispensa conexão com Redis. Confirmar isolamento pelo par tenant/projeto nos canais/chaves e autenticação do serviço. Redis indisponível no startup avançado reprova readiness; em operação, não permitir mutação protegida por limite sem checagem efetiva. O protocolo de sequência/replay e a execução do agente após reinício não são resolvidos por pub/sub: proibir configuração/documentação de múltiplas réplicas de API até Item 4/20 e coordenação restante estarem concluídos. Alternativa: instalar Redis sem consumidor (configuração avançada enganosa); adicionar fila/worker nesta change (mistura o escopo do Item 4).

### 6. Novo perfil exige nova instalação, sem transporte de dados

O setup `ADVANCED` provisiona tenant/admin em uma base PostgreSQL nova e vazia e em um volume persistente novo; jamais aponta para uma base SQLite existente como origem de dados. O setup `SIMPLE` usa SQLite novo, mantendo compatibilidade de startup para instalações SQLite legadas do mesmo perfil. Alterar `AZYBOARD_INSTALL_PROFILE` ou `DATABASE_URL` na mesma instância lógica não é mecanismo de transição: a identidade persistida no volume e o marcador do banco recusam a mudança. Se o usuário testou em SQLite e não quer os dados, instala ADVANCED em outra instância e começa do zero. Se tem dados de produção que quer manter, faz um projeto externo de migração por conta própria: esta change não fornece comando de importação, ferramenta de conversão, cutover nem rollback entre perfis. Backups e restore continuam sendo cuidados operacionais **dentro** do perfil escolhido, incluindo o marcador do volume; criar uma nova instalação não apaga automaticamente a anterior. Alternativa rejeitada: embutir upgrade bidirecional ou unilateral, elevando custo e risco sem ser exigido pelo produto.

### 7. Gate de release e documentação honesta

Manter `bun run check` sem serviços externos; CI sobe PostgreSQL/Valkey temporários e executa schema/migrations, auditoria, contratos críticos HTTP/MCP, relações multi-tenant, setup novo nos dois perfis e rejeição de troca de perfil na mesma instalação. Guia SIMPLE em poucos comandos e ADVANCED com recursos, volumes, backups, TLS e restrição de uma API; deixar clara a perda de continuidade dos dados caso o operador faça uma instalação nova sem seu próprio projeto de migração. Ao concluir esta change, o perfil avançado suporta **PostgreSQL + Redis em uma instância**; expandir para HA fica bloqueado por Item 4/20/31. Alternativa: depender de um serviço externo no check local, eliminando a leveza desejada.

## Risks / Trade-offs

- [Portabilidade de 871 linhas de schema, SQL SQLite e centenas de acessos diretos em rotas] → extrair ports por domínio, refatorar rotas em fatias mantendo adapter SQLite verde e só então implementar os adapters PostgreSQL; não declarar ADVANCED pronto com rotas incompletas.
- [Equivalência de IDs, booleanos, BLOBs e timestamps entre dois schemas novos] → testar contratos observáveis de instalações separadas; sem conversão de dados entre elas.
- [Operador troca variável e acha que os dados serão transferidos] → bloquear configuração incompatível e explicar no setup que é necessária instalação nova e que dados antigos não são importados.
- [Redis pub/sub perde eventos] → não prometer replay/sincronização forte nem múltiplas instâncias; Item 20 trata reconciliação.
- [Mesmo PostgreSQL com agente em processo HTTP e controles não distribuídos] → perfil avançado roda uma API até Item 4 e demais controles estarem migrados.
- [Licença do servidor Redis varia por versão] → preferir Valkey (BSD) e cliente Redis-compatível com licença permitida; validar licenças e versões no deploy.
- [Configuração acidental/segredo vazado] → validar origem e marcador sem registrar credenciais; `.env.example` contém somente placeholders.

## Migration Plan

Plano de implantação da **mudança de software**, sem migração de dados de uma instalação SIMPLE para ADVANCED ou vice-versa:

1. Inventariar schema/SQL/estado transitório e fixar baseline; já concluído em `portability-inventory.md`.
2. Implementar perfil, marcadores e rejeição de reconfiguração mantendo SIMPLE funcional.
3. Extrair ports/UnitOfWork e migrar as rotas por domínio para o adapter SQLite; executar regressão após cada fatia.
4. Implementar schema/migrations e adapters PostgreSQL atrás dos mesmos ports; executar paridade API/MCP/analytics/segurança.
5. Integrar Valkey apenas no adapter ADVANCED para coordenação definida; SIMPLE não abre conexão externa.
6. Concluir setup independente por perfil, documentação, CI e testes em instalações temporárias novas. Nunca transferir dados, alterar automaticamente o labapps nem apagar bases existentes.

## Open Questions

- Escolha operacional final: PostgreSQL e Valkey gerenciados externamente ou compose público versionado? Proposta: exemplos compose locais, URLs externas igualmente aceitas; sem vincular a infraestrutura privada do labapps.
- Qual volume/concorrência medido justifica mudar de perfil? Proposta: ~20 pessoas como orientação, sem limite imposto; registrar benchmark antes de prometer escala.
- Habilitar múltiplas réplicas somente após itens 4, 20 e verificação dos controles de orçamento/locks; esta change mantém esse limite explícito.
