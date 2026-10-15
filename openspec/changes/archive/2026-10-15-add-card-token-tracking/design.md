# Design

## Context

Ver `proposal.md - Why`. Pontos de partida que moldam o desenho:

- O item já tem o campo `points` (inteiro anulável, check `>= 0`) como precedente de
  campo numérico opcional com exibição no card e no modal.
- O consumo de IA já é medido na tabela `assistant_runs` (`inputTokens`/`outputTokens`),
  mas isso é por run do assistente interno, não por card.
- O catálogo MCP vive em um único descritor em `packages/tool-registry` (schema,
  validação, policy, routing, executor). A allowlist de campos de item aparece, hoje,
  duplicada em cinco pontos (registry, validation, `batch.ts`, `application/items.ts`,
  projeções).
- `update_items` aplica o MESMO conjunto de `changes` a todos os itens filtrados; não há
  como enviar valores distintos por card. `check_items` já é o precedente de ferramenta
  em lote com entradas independentes por item.
- O harness OpenCode mantém os logs de sessão em `~/.local/share/opencode/opencode.db`
  com `tokens_input`, `tokens_output`, `tokens_reasoning`, `tokens_cache_*` e `cost` por
  sessão, além de `directory` e `title` — insumo do backfill massivo.

Escopo definido com o usuário: **núcleo primeiro** (dados + API + MCP + skill + exibição
no card); visualizações de dashboard ficam para uma change futura.

## Goals / Non-Goals

**Goals:**

- Registrar tokens de entrada/saída por card, com total derivado, e exibir no card e no
  modal.
- Permitir registro individual (edição de item) e massivo (uma chamada, vários cards).
- Fazer a IA registrar tokens ao encerrar, com aviso não bloqueante quando esquecer.
- Dar roteiro de backfill a partir dos logs de sessão do harness.

**Non-Goals:**

- Recortes e gráficos de tokens no dashboard.
- Captura automática de tokens pelo servidor (o servidor não lê logs de harness).
- Custo monetário por card, tokens de raciocínio/cache e proveniência por sessão.
- Alterar o modelo de work log ou o contrato `H:MM` do Diário.

## Decisions

### Tokens como campos do item, não como apontamento

`tokensInput` e `tokensOutput` entram em `items` como inteiros anuláveis, espelhando
`points`; o total é derivado (soma) e nunca persistido. **Alternativa considerada:**
guardar tokens em `item_logs` (por apontamento, junto de `durationMin`). Rejeitada pelo
usuário: o pedido é um campo único no card, mais simples de preencher e de mostrar, sem
multiplicar registros por sessão.

### Ferramenta em lote dedicada `set_item_tokens`

Como `update_items` não permite valores distintos por item, o registro massivo usa uma
nova ferramenta `set_item_tokens` com `items: [{ itemId, tokensInput, tokensOutput }]`,
classificada `evidence/item/update` e policy de escrita — o mesmo padrão de `check_items`
(atomicidade por item, falhas identificadas por entrada). **Alternativas:** (a) N
chamadas de `update_item` — contraria o pedido de "uma vez só" e aumenta risco de lote
parcial; (b) mudar `update_items` para aceitar valores por item — alteraria a semântica
atual de "mesmo valor para todos".

### Aviso não bloqueante em `complete_task`

A resposta de `complete_task` ganha um aviso quando o card é concluído sem tokens e há
indício de execução por agente (item atribuído a API key ou executor não humano). O
aviso não altera o fluxo: o card ainda move para `DONE`. **Alternativa:** bloquear a
conclusão — rejeitada por risco de travar o board quando a medição não estiver
disponível.

### Backfill dirigido pela skill, não pelo servidor

O preenchimento massivo é responsabilidade do agente: ler os logs de sessão do harness
(somente leitura), filtrar pelo diretório do projeto, associar cada sessão a um card pelo
título/referência de card e enviar um único `set_item_tokens`. Sessões ambíguas não são
atribuídas automaticamente. O servidor não lê `opencode.db`: isso acoplaria o produto a
um harness específico e a um caminho de arquivo local.

### Auditoria e integridade

Alterações de token entram nos `loggableFields` de item (mesma trilha de `points`) e
geram evento automático. Não há evento de analytics por token nesta change, já que o
dashboard está fora de escopo. A validação de não-negatividade é feita na validação e no
schema; como SQLite não aceita `ADD COLUMN ... CHECK`, a migration aditiva não cria check
no SQLite — a garantia vem da validação de entrada e de um invariante no verificador de
integridade, com check nativo no PostgreSQL.

## Risks / Trade-offs

- **Allowlist duplicada em cinco pontos** → campo silenciosamente ignorado se faltar em
  algum. Mitigação: atualizar todos os pontos (registry, validation, `batch.ts`,
  `application/items.ts`, projeções) e cobrir com testes de contrato.
- **Precisão do backfill** → mapear sessão→card pode errar. Mitigação: não atribuir
  casos ambíguos; exigir confirmação do usuário para dúvidas.
- **Sem proveniência** → o campo não distingue se foi humano ou IA quem preencheu.
  Mitigação: registrar no log de auditoria (executor/origem) quem escreveu; proveniência
  fina fica como questionamento aberto.
- **Testes que fixam chaves de item** → adicionar tokens à projeção/resumo quebra
  contratos existentes. Mitigação: atualizar `tools.test.ts`, `registry-contract.test.ts`
  e `optional-fields.test.ts` na própria change.
- **Tokens muito acima de `INTEGER`** → improvável no curto prazo; o tipo inteiro cobre a
  faixa realista de uma task.

## Migration Plan

1. Migration aditiva no SQLite (`0052_...`) e no PostgreSQL (`0025_...`) adicionando
   `tokens_input` e `tokens_output` (`INTEGER NULL`); no PG, com check `>= 0`.
2. Sem backfill de dados: cards existentes ficam com campos nulos (estado "sem tokens").
3. Rollback: remover as colunas (não há dependência de dados derivados persistidos).

## Open Questions

- Deve existir um campo de proveniência (humano vs IA) ou referência de sessão por card
  em uma change futura?
- O dashboard deve recortar tokens por projeto/status/sprint, e vale registrar evento de
  analytics por token quando isso for implementado?
