# Design

## Contexto

O registro de auditoria (`item_logs`) guarda três informações de identidade: `author_id`
(usuário do tenant), `actor_type` (`HUMAN`, `AGENT`, `SYSTEM`, `UNKNOWN`), `actor_label`
(rótulo da ferramenta, só para agente) e `source` (`REST`, `MCP`, `SYSTEM`).

O SQLite resolve o autor na leitura (drizzle `with: { author }`). O PostgreSQL não: o
`SELECT *` não junta `users` e `mapItemLog` fixa `author: null`. Como produção roda o
perfil ADVANCED, o painel nunca recebe o nome de quem alterou.

## Decisão 1 — resolver o autor na leitura, sem snapshot

**Escolhido:** `LEFT JOIN users u ON u.tenant_id = l.tenant_id AND u.id = l.author_id`
em `listItemLogs` e `getItemLog`, com `mapItemLog(row, author)`.

**Alternativas descartadas:**
- *Gravar o nome no log (`actor_label` para humano):* cria snapshot e exige backfill;
  fica desatualizado quando a pessoa muda o nome. A FK de `author_id` é `NO ACTION`,
  então o usuário não some enquanto houver log — o JOIN é suficiente.
- *Resolver no route handler:* duplicaria a regra e deixaria o port (usado também pelo
  MCP via HTTP) sem o autor.

**Consequência:** o `JOIN` acrescenta uma leitura por chave primária de `users` — custo
desprezível sobre uma página de 20 logs. As condições do `WHERE` passam a ser
qualificadas com `l.` porque `users` também tem `tenant_id`.

## Decisão 2 — identidade e tipo são coisas diferentes

O painel mostrava `label = actorLabel ?? author.name ?? "Humano"`. Quando não havia nome,
o **tipo** virava **nome** — e a pessoa lia "Humano" onde deveria ler o nome de alguém.

**Escolhido:** componente `LogActor` com quatro casos explícitos:

| Caso | Identidade | Selo |
| --- | --- | --- |
| Humano com autor | `@Nome` (duas partes, tooltip com o completo) | Humano |
| Humano sem autor | "Autor não identificado" | Humano |
| Agente | rótulo do agente (`actor_label`) | Agente |
| Sistema | "Sistema" | — (repetiria) |
| Origem desconhecida | nome do autor, se houver; senão fallback | Desconhecido |

Menção é de pessoa: agente nunca vira `@`. Automação com autor humano no registro
(`author_id` do dono da API key) continua exibindo o rótulo do agente — é o que impede
atribuir a automação à pessoa.

## Decisão 3 — uma regra de nome para os dois painéis

Histórico e Diário usam o mesmo componente e a mesma regra T76 (`displayPersonName`,
duas partes, limite de 15 caracteres, nome completo em `title`). O Diário passa a exibir
o selo de origem porque lançamentos feitos por agente via MCP também são `manual`.

O contrato `WorkLog` ganha `actorType`, `actorLabel` e `source` opcionais — a API já os
devolvia, mas o tipo os descartava.

## Riscos

- **Dado legado com `actor_type = UNKNOWN`:** passa a aparecer como "Desconhecido", não
  mais como "Humano". É a leitura correta: a origem realmente não foi gravada.
- **Nome longo em coluna estreita:** o corte T76 mantém o layout; o tooltip preserva a
  identificação exata.
- **Paridade entre perfis:** o teste de paridade compara a forma do autor (nome e avatar),
  não os IDs, porque cada banco gera usuários próprios.
