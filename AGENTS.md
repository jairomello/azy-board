# Instruções para agentes — Azy Board

Produto: Kanban board AI-native para equipes mistas (humanos + agentes de IA).

## Idioma

Código, comentários, commits, mensagens e documentação em **português do Brasil**.

## Azy Board é a fonte de planejamento e execução

- Se `AZYBOARD_PROJECT_ID` estiver configurada, o projeto da codebase é o board
  padrão e `projectId` pode ser omitido nas ferramentas MCP.
- Ao trabalhar em algo ligado a um card, carregue a skill **`azyboard`** e siga
  o fluxo obrigatório (descobrir projeto, ler coluna, mover para `Fazendo`,
  `claim_task` quando atribuível).
- Não invente IDs, relações ou permissões. `get_board` é a fonte operacional.

## Ferramentas MCP: chamadas isoladas, nunca paralelas

- Emita **uma chamada por vez** para ferramentas MCP (`azy-board_*` e demais
  servidores), nunca em paralelo com outras ferramentas. Chamadas paralelas
  (especialmente do mesmo tipo) corrompem a serialização dos argumentos no
  cliente e produzem `JSON parsing failed: Text: {...` com `Unexpected EOF` —
  ou pior: mesclam o argumento de uma chamada dentro de outra, criando
  duplicatas silenciosas de cards.
- Se ocorrer `JSON parsing failed` / `Unexpected EOF`, repita a mesma intenção
  uma única vez, isoladamente, sem paralelismo.

## Encerramento de trabalho ligado a um card (obrigatório)

- Todo trabalho que tenha um card no Azy Board termina com o card em uma coluna
  cujo `baseStatus` seja `DONE` (normalmente `Concluídas`).
- Isso vale também para mudanças **OpenSpec** vinculadas a um card: encerrar a
  change não encerra o card.
- `create_item_log`, comentários e checklists **não** substituem o fechamento.
  Eles registram histórico, mas não movem o card.
- Fluxo de fechamento: executar `complete_task` e **confirmar no board real**
  (`get_board`/`list_tasks`) que o `status` do card é `DONE`. Se a confirmação
  falhar, não declare o trabalho concluído.
- Se houver mudança OpenSpec vinculada, registre `Board ref: <itemId>` nos
  artefatos da change para que o encerramento seja rastreável.
- Se não estiver claro qual card corresponde ao trabalho, pergunte antes de
  encerrar em vez de adivinhar.

## Verificação antes de declarar concluído

- `bun run check` (typecheck + lint + testes + build).
- `bun run test:smoke` para o fluxo web/API.
- Alterações em `skills/azyboard/` exigem `bun run test:agent-skill`.

## Referências

- Skill oficial: [`skills/azyboard/`](skills/azyboard/) (`bun run test:agent-skill`).
- Análise técnica: [`docs/ANALISE-SISTEMA.md`](docs/ANALISE-SISTEMA.md).
