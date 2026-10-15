# Proposal

## Why

Hoje um card registra pontos e horas, mas não o consumo de tokens de IA gasto na
implementação. Sem uma base histórica de tokens por task, não há como estimar o
esforço/custo de IA de features futuras. O card **T77 — Campo novo: Tokens** pede
registrar esse consumo por card, exibir os números com facilidade e permitir que a
própria IA preencha os valores ao concluir — inclusive de forma massiva, a partir do
log de sessões do harness.

Board ref: 25e1d51c-bc85-4479-9b75-832520319fe7

## What Changes

- Novo par de campos no item: `tokensInput` e `tokensOutput` (inteiros não-negativos,
  opcionais). O **total de tokens** é derivado da soma e apresentado como `N tokens`.
- Exibição dos tokens no card do Kanban e no modal de edição (área de planejamento),
  no mesmo padrão do campo de pontos.
- MCP: campos de token aceitos em `update_item`/`update_items`, projeção e resposta do
  item, e uma nova ferramenta de **registro em lote** `set_item_tokens` (uma chamada,
  vários cards), no padrão de `check_items`.
- `complete_task` passa a devolver um **aviso não bloqueante** quando o card foi
  trabalhado por agente e não tem tokens registrados.
- Skill `azyboard`: passo explícito de registrar tokens ao encerrar o card e roteiro de
  backfill massivo — ler os logs de sessão do harness (ex.: base do OpenCode), atribuir
  por card e enviar um único lote.
- Auditoria: alteração de tokens gera log automático, como já ocorre com pontos.
- **Fora desta change**: recortes e visões de tokens no dashboard (change futura).

## Capabilities

### New Capabilities

- `card-token-tracking`: registro, validação, exibição e backfill massivo do consumo de
  tokens de IA por card.

### Modified Capabilities

- `mcp-tool-registry`: declara os campos de token no catálogo, a ferramenta em lote
  `set_item_tokens`, a projeção/resposta com tokens e o aviso do `complete_task`.
- `official-agent-skill`: exige que a skill documente o registro de tokens no
  encerramento e o roteiro de preenchimento massivo a partir dos logs de sessão.
- `card-activity-log`: inclui a alteração de tokens entre os campos que geram evento
  automático de auditoria.

## Impact

- **Dados**: duas colunas anuláveis em `items` (SQLite e PostgreSQL) com validação de
  não-negatividade, mais migration aditiva em ambos os perfis.
- **API REST**: aceitar/persistir/expor tokens em criação e edição de item, incluindo o
  endpoint de lote (`POST /items/update`) e a projeção de listagem.
- **Tool registry / MCP**: `update_item`, `update_items`, `list_tasks` (projeção),
  `create_task` (opcional), `complete_task` (aviso) e a nova `set_item_tokens`.
- **Web**: card do Kanban, modal do item e tipos do frontend.
- **Skill e docs**: `skills/azyboard` (com espelho `.opencode`), `apps/mcp/README.md` e
  a wiki do produto.
- **Sem** dependências novas e **sem** alteração de permissões (tokens seguem o mesmo
  nível de escrita de pontos).
