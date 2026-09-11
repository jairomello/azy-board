# Design: Add Azy Agent Eval Suite

## Context

O Azy Agent roda no `AssistantHarness` (`apps/api/src/services/assistantHarness.ts`) com providers OpenAI/OpenRouter, tools registradas (`assistantTools.ts`) e um system prompt com contratos fortes (escopo, hierarquia, batch, aprovações). A regressão existente é determinística e não usa modelo. O repo tem stack Bun + drizzle (sqlite in-memory nos testes) e `bun run check` como gate de qualidade.

O desafio dos evals: LLMs são probabilísticos — respostas mudam entre execuções —, então a suíte precisa de verificação determinística sempre que há ground truth, LLM-as-judge para critérios qualitativos, e thresholds com margem em vez de asserts binários por caso.

## Goals / Non-Goals

**Goals:**
- Medir qualidade do agente end-to-end (prompt + modelo + harness + tools + DB) por release.
- Métricas por dimensão: task completion, tool correctness, faithfulness, escopo/relevância, segurança, prompt alignment.
- Gate de release com thresholds e relatório comparável entre versões.
- Rodar determinístico: temperatura mínima, dados seedados, zero dependência de estado externo.

**Non-Goals:**
- Avaliação online/contínua sobre tráfego de produção.
- Benchmarks de modelos externos genéricos (MMLU etc.).
- Fine-tuning, otimização de prompt automática ou tracing de produção.
- Trocar o framework de testes existente.

## Decisions

### D1 — Framework próprio leve, não DeepEval/LangSmith
Implementar runner próprio (poucas centenas de linhas em Bun/TS) com apenas um judge via `ModelProvider` existente.
- **Por quê**: o repo não tem Python nem mais uma dependência pesada; o judge já tem abstração de provider (`openaiProvider`/`openrouterProvider`); métricas determinísticas (tool correctness, estado do DB) viram código simples. DeepEval é pytest-native (Python) e não se encaixa.
- **Alternativa rejeitada**: DeepEval/Ragas — melhor cobertura de métricas prontas, mas Rust/Python no pipeline e judge externo; custo de manutenção > benefício para uma suíte curada de release.

### D2 — Execução via AssistantHarness real + DB in-memory seedado
Cada caso roda `AssistantHarness` com provider real contra sqlite in-memory semeado com projeto/boards de referência (mesma receita de `agentRegression.test.ts`), extraindo: tool calls (nome + args), execução das tools e texto final. Assim o eval mede o sistema inteiro, não o modelo isolado.
- **Por quê**: eval só de prompt ignora schema/validação das tools; eval só de unidade ignora o comportamento composto do modelo.

### D3 — Métricas em duas camadas
1. **Camada determinística (código)**: tool correctness (tool chamada e args-chave esperados), task completion (estado do DB após a run — item criado, campo atualizado), escopo por recusa (resposta não chama tool quando deve recusar ≤40 ações), no-leak de erros (sem stack/secrets na saída).
2. **Camada LLM-as-judge**: faithfulness (resposta ancorada nos resultados das tools), relevância/escopo (só sobre Azy Board), segurança (toxicidade/bias), alinhamento com o system prompt no estilo da resposta.
- **Por quê**: conforme as boas práticas de mercado, graders baseados em código são a espinha dorsal; judge só onde não há ground truth. Judge usa saída estruturada (JSON strict) para evitar parsing frágil.

### D4 — Dataset versionado em TS fortemente tipado
`apps/api/src/evals/datasets/*.ts`: cada caso tem `id`, `userMessage`, `setup` (seed declarativo), `expected` (tools esperadas, estado do DB, recusas) e `lints` (critérios de judge). Versionado no repo, revisável em PR como código.
- **Por quê**: type-safety com os schemas das tools; fácil de estender; git-friendly.

### D5 — Cadência: `bun run evals` (informal) e `bun run evals:gate` (por release)
- `bun run check` **não** muda: continua determinístico.
- `evals:gate` compara scores com thresholds em `apps/api/src/evals/config.ts` e sai com código de erro em violação — para CI por tag/release (workflow agendado ou manual), com a chave do provider via secret.
- Relatório em JSON/Markdown em `tmp/eval-reports/<timestamp>.json` com hash do dataset e comparação com o relatório anterior (aviso de regressão de qualidade mesmo dentro do threshold).
- **Alternativa rejeitada**: evals em todo PR — custo de API e não-determinismo derrubam a confiança do gate.

### D6 — Provider e temperatura
Usar o provider configurado (OpenRouter/OpenAI) com `temperature: 0` e seed quando suportado; um `maxOutputTokens` reduzido por caso. Casos marcados como `judge` reutilizam o mesmo provider para o judge, com prompt de judge versionado e saída JSON estrita (score 0–1 + justificativa curta), definindo um modelo de judge separável via env (`AZY_EVAL_JUDGE_MODEL`).

## Risks / Trade-offs

- [Não-determinismo dos LLMs gera flaky failures] → temperatura 0, thresholds com folga (ex.: segurança = 1.0, task completion ≥ 0.9), casos repetíveis marcados `retry: 2` para flakiness residual.
- [Custo de API na suíte] → dataset curado (início: ~20–30 casos), contexto mínimo nos setups, suíte configurável por subconjunto (`--filter`).
- [Judge tendencioso/fracasso do judge] → saída JSON estrita, escala 0–1 com critérios explícitos e curtos; qualquer erro do judge conta o caso como criticável no relatório, não como sucesso silencioso; métricas mais sensíveis (segurança) usam dupla verificação determinística quando possível.
- [Chave de API ausente em CI] → `bun run check` nunca executa evals; `evals` pula com aviso visível e exit 0; só `evals:gate` exige a chave (erro explícito se ausente, para não publicar release sem gate).
- [Regressão silenciosa entre releases] → relatórios versionáveis com comparação automática com o baseline anterior e aviso de queda ≥ x% por métrica.

## Migration Plan

1. Criar estrutura `apps/api/src/evals/` (runner, métricas, judge, config, datasets).
2. Adicionar `scripts/evals.ts` e entradas no `package.json` (`evals`, `evals:gate`).
3. Adicionar script de CI por release (workflow a ser respeitado pelo padrão do repo); documentar em `TESTING.md`.
4. Rollback: nada acoplado ao app — remover scripts/estrutura ou desabilitar o job de CI; app/produção não é afetado.

## Open Questions

- Qual modelo padrão de judge (menor latência/custo do provider atual) — definir na primeira execução observando estabilidade.
- Qual função de agregação para o gate (média ponderada por dimensão vs. mínimos por dimensão) — proposta inicial: mínimos por dimensão, mais exigente e interpretável.
