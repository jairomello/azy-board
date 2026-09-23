## Why

O projeto acumulou múltiplas fontes de verdade para os mesmos fatos: README, CHANGELOG, `docs/`, 78 páginas de wiki, `apps/mcp/README.md`, `DEPLOY*`, `TESTING.md`, `CONTRIBUTING.md` e as specs OpenSpec. A auditoria recente encontrou dezenas de afirmações desatualizadas e, pior, contraditórias com o runtime. Exemplos confirmados no código:

- O README afirma limites do Azy Agent ("4 steps, 8 tool calls, 45 segundos, 50 KB") enquanto o runtime usa `defaultGovernance` (`maxSteps: 32`, `maxToolCalls: 40`, `timeoutMs: 90_000`, `maxPayloadBytes: 100_000`) e ainda há `HARNESS_LIMITS` com outros números.
- O README descreve "CSV import with preview" no agente, funcionalidade não ligada à UI.
- O README afirma que "toda mutação exige aprovação humana", mas o MCP externo executa mutações diretamente com API key.
- `DEPLOY.md` usa SQLite em produção, enquanto o README apresenta "SQLite (dev) → PostgreSQL (prod)".

O problema não é falta de documentação, mas excesso de cópias de fatos voláteis. Manter tudo sincronizado manualmente já excede a capacidade do processo atual.

## What Changes

- Definir papéis claros por documento: **código/schema/runtime** como fonte dos contratos, **OpenSpec** para decisão e comportamento, **wiki** para uso do produto, **README** para arquitetura e início rápido, **CHANGELOG** para histórico.
- Tornar **gerados a partir do runtime** os artefatos voláteis: catálogo MCP (do registry), documento OpenAPI (dos schemas de validação) e tabelas de limites (de constantes compartilhadas). O texto gerado passa a ter cabeçalho de origem e comando de regeneração.
- Introduzir um módulo único de **constantes de limites** do Azy Agent e do harness, consumido pelo runtime e pela geração de docs.
- Adicionar verificação de integridade de documentação: artefatos gerados em dia, referências numéricas do README/wiki conferidas contra as constantes, links internos válidos e ausência de afirmações proibidas (ex.: "toda mutação exige aprovação", "CSV import" sem funcionalidade).
- Corrigir as afirmações divergentes encontradas (limites, CSV, aprovação, SQLite/PostgreSQL).
- Incluir revisão de documentação na definição de pronto (checklist de PR em `CONTRIBUTING.md`).

## Capabilities

### New Capabilities
- `documentation-integrity`: Papéis de cada fonte de documentação, geração de referências voláteis a partir do runtime (catálogo MCP, OpenAPI, limites), fonte única para constantes de limites, verificação de integridade (gerados em dia, números conferidos, links válidos, afirmações proibidas) e revisão de docs na definição de pronto.

### Modified Capabilities
- `continuous-integration`: o CI passa a executar o gate de integridade de documentação (artefatos gerados em dia e referências consistentes) como verificação obrigatória.

## Impact

- `apps/api/src/routes/assistant.ts` e `apps/api/src/services/assistantHarness.ts`: extrair limites para um módulo de constantes compartilhado.
- `apps/api/src/validation.ts`: expor o documento OpenAPI para geração versionada.
- `apps/mcp/README.md`: catálogo passa a ser gerado (ou sua seção de catálogo é gerada a partir de `registry.ts`).
- `docs/` e `README.md`: correção das afirmações divergentes; redução de detalhes voláteis duplicados.
- `scripts/`: novos geradores (`generate:mcp-catalog`, `generate:openapi`, `generate:limits`) e verificador `check:docs`.
- `CONTRIBUTING.md`: revisão de docs no checklist de PR.
- `.github/workflows/ci.yml` e `scripts/regression.ts`: novo gate de documentação.
- Sem impacto no comportamento de produção; mudanças de runtime limitadas à extração de constantes.
