# Tasks: Add Azy Agent Eval Suite

## 1. Estrutura base da suíte

- [x] 1.1 Criar pasta `apps/api/src/evals/` com tipos base (`EvalCase`, `EvalReport`, `Dimension`, scorer contracts) fortemente tipados
- [x] 1.2 Criar `apps/api/src/evals/config.ts` com thresholds por dimensão, margem de regressão, modelo/config do judge (`AZY_EVAL_JUDGE_MODEL`) e flag de retry para casos flaky
- [x] 1.3 Adicionar fixture de seed reutilizável (tenant, usuários, projeto, boards, módulos, colunas, sprint) pura, sem credencial, reutilizando a receita de `agentRegression.test.ts`

## 2. Runner e execução do agente

- [x] 2.1 Implementar runner que executa cada caso via `AssistantHarness` com provider real, temperatura 0, contra DB in-memory seedado, capturando tool calls, args, resultados e texto final
- [x] 2.2 Implementar skip condicional: sem `AZY_PROVIDER_API_KEY` a suíte pula com aviso claro e exit 0; `evals:gate` sem credencial falha com erro explícito
- [x] 2.3 Implementar `--filter` e `--dry-run` (listar casos sem chamar provider) na CLI da suíte

## 3. Métricas

- [x] 3.1 Implementar camada determinística: tool correctness (tool + args-chave esperados), task completion (estado do DB pós-run), recusa em pedidos > 40 ações e no-leak de secrets/stack na saída
- [x] 3.2 Implementar judge (LLM-as-judge via `ModelProvider`) com prompt versionado, saída JSON estrita em escala 0–1 para faithfulness, escopo/relevância, segurança e alinhamento ao system prompt
- [x] 3.3 Tratar falha/parse inválido do judge como caso indeterminado no relatório (nunca sucesso), respeitando retry configurado
- [x] 3.4 Calcular agregação por dimensão (média por caso, mínimos para o gate)

## 4. Dataset de casos

- [x] 4.1 Criar `apps/api/src/evals/datasets/` com casos iniciais curados (~20–30): criação de projeto (mínimo/completo), hierarquia individual e em lote, atualização filtrada, bulk move com/sem "tipos" explícitos, pergunta de leitura, pergunta fora de escopo, pedido mutação grande (>40 ações) e tentativa de leve privilege/injection no conteúdo
- [x] 4.2 Cada caso com `setup` declarativo, expectativa determinística e lints de judge; hash determinístico do dataset no relatório

## 5. Relatórios e gate

- [x] 5.1 Gerar relatório JSON + Markdown em `tmp/eval-reports/` com score por caso/dimensão, justificativas de judge, hash do dataset, modelo/provider e timestamp
- [x] 5.2 Implementar comparação automática com o baseline anterior (último relatório) e aviso de queda ≥ margem por dimensão
- [x] 5.3 Implementar `scripts/evals.ts` e `scripts/evalGate.ts` com exit codes; adicionar `evals` e `evals:gate` ao `package.json`

## 6. CI, documentação e verificação

- [x] 6.1 Adicionar job de CI disparado por release/tag/manual que roda `bun run evals:gate` com secret do provider (seguindo o padrão de workflows do repo)
- [x] 6.2 Atualizar `TESTING.md` e `CONTRIBUTING.md` documentando cadência (por release), como adicionar casos, thresholds e interpretação do relatório
- [x] 6.3 Verificar: `bun run typecheck`, `bun run lint` e `bun run check` passam sem credencial; `bun run evals` pula com aviso; `bun run evals:gate` falha com erro explícito de credencial ausente; executar suíte completa uma vez com credencial real e ajustar thresholds se necessário
