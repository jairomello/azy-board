# Proposal

## Why

O painel **Histórico de alterações** não identifica quem fez cada registro humano: todas as entradas aparecem com o rótulo genérico **"Humano"** no lugar do nome da pessoa. Agentes aparecem corretamente ("Open Code"), o que esconde a causa — não é falta de dado, é falta de leitura.

A causa está no adapter **PostgreSQL** (perfil ADVANCED, o de produção): `listItemLogs` e `getItemLog` fazem `SELECT * FROM item_logs` sem juntar `users`, e `mapItemLog` devolve `author: null` fixo. O adapter SQLite hidrata o autor; o PostgreSQL não. Com `author` nulo e `actor_label` nulo (humanos não têm rótulo de ferramenta), a UI cai no fallback `t('accordion.human')` e escreve "Humano" como se fosse nome.

Evidência em produção (card T122): o log de 11/11/2026 18:01 tem `authorId = 8bac7eb0-…` (Camila C. A. Martins, membro ativa), `actorType = HUMAN`, `actorLabel = null` e `author = null`. O mesmo card devolve o autor corretamente no campo Autor — o dado existe; só o caminho dos logs perde a identidade.

Além da causa raiz, dois problemas de apresentação: o fallback transforma o **tipo** do executor em **nome**, e registros de origem `UNKNOWN` (default da separação auditoria/diário) também são rotulados "Humano". O Diário de trabalho usa o mesmo fallback e sofre do mesmo defeito.

## What Changes

- **Leitura de logs resolve o autor nos dois perfis de instalação**: `listItemLogs` e `getItemLog` do adapter PostgreSQL passam a fazer `LEFT JOIN users` (por `tenant_id` e `id`) e devolver `author { id, name, avatarUrl }`, igual ao SQLite.
- **Identificação do autor vira componente compartilhado** entre Histórico e Diário de trabalho, com uma regra única:
  - pessoa identificada aparece como **menção `@Nome`** em duas partes, com o nome completo no tooltip (regra T76);
  - automação aparece pelo **rótulo do agente**, nunca como menção de pessoa;
  - sistema aparece como **Sistema**;
  - sem nome resolvido, o painel diz **"Autor não identificado"** — nunca usa o tipo do executor como nome;
  - o selo de tipo (Humano/Agente/Sistema/**Desconhecido**) fica separado do nome, e `UNKNOWN` deixa de ser tratado como humano.
- **Diário de trabalho** recebe a mesma identificação (inclusive lançamentos feitos por agente via MCP), com `actorType`/`actorLabel`/`source` expostos no contrato `WorkLog`.

**Fora do escopo:** gravar o nome do autor como snapshot no registro (`actor_label` de humano) e backfill de `actor_type` em registros antigos. O JOIN resolve o histórico existente; o fallback cobre autor removido.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `card-activity-log`: o histórico identifica o autor por nome e menção, com fallback explícito, e a API de auditoria devolve o autor resolvido em qualquer perfil de instalação.
- `card-work-log`: o diário exibe o autor de cada registro com a mesma regra e a API resolve o autor no tenant atual em qualquer perfil.
- `person-name-display`: o nome do autor no histórico e no diário segue a regra de duas partes, com o nome completo acessível por tooltip.

## Impact

- **API:** `apps/api/src/db/postgres/adapter.ts` (`mapItemLog`, `listItemLogs`, `getItemLog`). Sem migration e sem mudança de schema.
- **Web:** novo `apps/web/src/components/LogActor.tsx`, usado por `ActivityLogPanel.tsx` e `WorkLogPanel.tsx`; chaves de i18n `accordion.unknown` e `accordion.unidentifiedAuthor` em pt-BR, en e es.
- **Contratos:** `packages/ui-contracts/src/index.ts` — `WorkLog` ganha `actorType`, `actorLabel` e `source` opcionais.
- **Testes:** paridade PostgreSQL (`parity.test.ts`) cobrindo hidratação do autor e log sem autor; integração (`integration.test.ts`) cobrindo `/audit` e `/work-log`; teste de componente do `LogActor`; contrato estrutural dos painéis.
- **Documentação:** wiki "Histórico de Atividades e Tempo Trabalhado".

- `Board ref: 228e7141-e724-467d-8a55-ff81c960a695` (card **B20** no Azy Board).

Decisões de desenho confirmadas com o usuário estão registradas em `design.md`.
