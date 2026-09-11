# Testes

## Visão Geral

O projeto usa vários níveis de verificação:

- Testes de integração Bun para o backend, com banco SQLite em memória.
- Testes unitários e de contrato para regras de domínio, UI e integrações MCP.
- Smoke test HTTP para validar uma aplicação local ou publicada.

Os testes não usam o banco persistente, não criam arquivos de upload e não
exigem credenciais reais.

## Local

Os testes de integração da API usam SQLite em memória e não alteram `dev.db`:

```bash
bun run test:integration
```

Esse comando executa `apps/api/src/integration.test.ts` e cobre:

- migração do schema e default `HIERARCHICAL`;
- criação de projetos simples e hierárquicos;
- criação automática da STORY fixa e associação de TASK;
- conversão simples para hierárquico e hierárquico para simples;
- ciclo de sprints `PROPOSED`, `OPEN` e `CLOSED`, incluindo datas obrigatórias e bloqueio de novas associações em sprints fechadas;
- preservação de cards, tags, sprints, anexos, checklists e logs;
- bloqueio de MEMBER e isolamento entre tenants.

Os contratos do servidor MCP podem ser verificados sem servidor externo:

```bash
bun run test:mcp
bun run test:mcp-catalog
```

Esses comandos cobrem o catálogo de ferramentas, validação de argumentos,
fluxos de board, idempotência, erros estruturados e a obrigatoriedade de
política de autorização por ferramenta. As API Keys usadas nos testes são
simuladas e não são credenciais reais.

Para a validação completa do monorepo:

```bash
bun run check
```

Com os servidores locais ativos, valide a publicação web e o endpoint de
autenticação:

```bash
bun run test:smoke
```

O smoke test verifica HTTP `200` na raiz e HTTP `401` em `/api/auth/me` sem
sessão. Para usá-lo contra outra instalação, defina `SMOKE_URL`.

## Evals do Azy Agent

O `bun run check` é determinístico e nunca chama provider de LLM. A qualidade,
segurança e completude das respostas do Azy Agent são medidas pela suíte de
evals, que roda o harness real (prompt + provider + tools + banco seedado)
contra um dataset versionado em `apps/api/src/evals/datasets/`.

Cadência de execução (boas práticas de mercado):

- `bun run evals` — execução informal a qualquer momento, com relatório em
  `tmp/eval-reports/`. Sem credencial de provider, pula com aviso e sai com
  sucesso (nunca bloqueia o fluxo determinístico).
- `bun run evals:gate` — gate de release. Deve rodar a cada versão/tag
  (workflow `.github/workflows/evals.yml` dispara por tag `v*` ou manualmente).
  Aplica thresholds mínimos por dimensão (task completion, tool correctness,
  faithfulness, escopo, segurança, no-leak, recusa e alinhamento) e falha o
  release se qualquer dimensão ficar abaixo do corte. Sem credencial, falha
  com erro explícito — nunca aprova silenciosamente.
- O relatório guarda hash do dataset, modelo/provider, scores por dimensão e
  casos reprovados; a execução compara com o baseline anterior e avisa queda
  acima da margem de regressão (configurada em
  `apps/api/src/evals/config.ts`).

Variáveis de ambiente:

- `AZY_PROVIDER_API_KEY` (ou `OPENAI_API_KEY` / `OPENROUTER_API_KEY`)
- `AZY_EVAL_PROVIDER` — `OPENAI` (padrão) ou `OPENROUTER`
- `AZY_EVAL_MODEL` — modelo executado nos casos
- `AZY_EVAL_JUDGE_MODEL` — modelo do LLM-as-judge (critérios qualitativos)

Em máquina local, para rodar as evals com exatamente o mesmo modelo/credencial
que o Azy Agent já usa (armazenadas cifradas em `apps/api/dev.db`):

```bash
bun run evals:env  # gera apps/api/.env.evals a partir do banco local
bun run evals      # os scripts de eval carregam apps/api/.env.evals automaticamente
```

`apps/api/.env.evals` contém a chave decifrada e é coberto por `.gitignore`
(`.env.*`); nunca comitar nem compartilhar. Regenerate com `evals:env` quando a
credencial ou o modelo forem trocados na aplicação.

Para filtrar a suíte durante o desenvolvimento verificação iterativa:

```bash
bun run evals --filter hierarchy-batch
bun run evals --dry-run  # lista casos sem chamar o provider
```

Como adicionar um caso de eval: crie uma entrada tipada `EvalCase` em
`apps/api/src/evals/datasets/core.ts` com mensagem do usuário, `setup`
(itens seedados), expectativas determinísticas (`expectedTools`,
`assertState`, `mustNotCallTools`) e, quando não houver ground truth,
`qualitativeLints` com critérios curtos e explícitos. O caso entra na suíte
automaticamente e no hash do dataset.

## Instalações Publicadas

Para validar uma instalação publicada, informe a URL base do ambiente:

```bash
SMOKE_URL=https://example.com/app bun run test:smoke
```

O resultado esperado é HTTP `200` para a aplicação e HTTP `401` para
`/api/auth/me` sem sessão.

O teste de integração da API usa banco SQLite em memória e pode ser executado
no mesmo ambiente de runtime, desde que os arquivos de teste estejam presentes
na imagem ou no workspace:

```bash
bun run test:integration
```

O seed de desenvolvimento também não aceita mais uma senha padrão. Se for
necessário executá-lo, informe uma senha temporária somente pelo ambiente:

```bash
SEED_ADMIN_PASSWORD='senha-local-temporaria' bun run db:seed
```

Procedimentos específicos de host, containers, domínios internos, SSH e
persistência devem ser mantidos na documentação privada da infraestrutura, fora
deste repositório.
