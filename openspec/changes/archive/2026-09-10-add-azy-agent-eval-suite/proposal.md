# Add Azy Agent Eval Suite

## Why

A suíte de regressão existente (`agent-regression-suite`) valida contratos determinísticos do harness (tools, hierarquia, batch), mas não mede a **qualidade das respostas do modelo**: se o Azy Agent alucina, responde fora de escopo, chama a tool errada ou deixa de completar a tarefa, nada falha hoje. Evals são o padrão de mercado para fechar essa lacuna: um protótipo de IA que "parece funcionar" precisa de uma nota de corte mensurável para chegar a produção — e o custo/latência desses testes exige cadência por release, não por commit.

## What Changes

- Criar uma **suíte de evals offline** para o Azy Agent com dataset versionado de casos de teste (pergunta do usuário → resposta esperada / tools esperadas).
- Cobrir as dimensões recomendadas pelo mercado: **task completion**, **tool correctness** (tool certa + argumentos certos), **faithfulness/hallucination** (resposta ancorada no resultado das tools), **relevância/escopo** (responde só sobre Azy Board), **segurança** (toxicidade, bias, não vazamento de dados fora do escopo) e **prompt alignment** (respeita o system prompt e o fluxo de aprovação).
- Rodar evals via **provider real** (OpenAI/OpenRouter) em modo controlado, com LLM-as-judge para critérios qualitativos e verificações determinísticas (código) sempre que houver ground truth.
- Integrar ao fluxo do repo: `bun run evals` roda a suíte; `bun run evals:gate` aplica thresholds mínimos para **gating de release** (CI agendado/manual por versão, não no `bun run check` tradicional).
- Gerar relatório dos resultados (score por métrica, casos com falha) versionável para comparação entre releases e detecção de regressão de qualidade.

## Capabilities

### New Capabilities
- `agent-eval-suite`: Suíte de evals de qualidade, segurança e completude do Azy Agent, com dataset versionado, métricas, thresholds e relatórios para gating de release.

### Modified Capabilities
- `agent-regression-suite`: Adicionar distinção explícita no contrato: regressão determinística continua no `bun run check`; evals de modelo rodam por release — sem alterar cenários existentes.

## Impact

- **Código novo**: estrutura de evals (`apps/api/src/evals/` com dataset, runners, métricas e relatório).
- **Scripts**: novos `evals.ts` e `evalGate.ts` em `scripts/` + entradas `evals`/`evals:gate` no `package.json`.
- **CI/docs**: job ou workflow opcional disparado por release/tag; atualização de `TESTING.md` documentando cadência e boas práticas.
- **Dependência de rede**: executa com provider real apenas quando `AZY_PROVIDER_API_KEY` está configurada; sem a chave, os evals são pulados com aviso (nunca quebram o check determinístico).
- **Custo/latência**: suíte enxuta por design (casos curados), executada por release e não por commit.
