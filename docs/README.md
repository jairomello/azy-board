# Documentação do Azy Board

Este índice define o papel de cada fonte de documentação. A regra central é
**não duplicar fatos voláteis**: quando um fato tem fonte derivável no runtime,
os documentos referenciam o artefato gerado em vez de repeti-lo.

## Fontes e papéis

| Fonte | Papel | O que pertence aqui |
|---|---|---|
| Código, schema e runtime | Fonte dos contratos | Tipos, schemas de validação, registry de ferramentas MCP, constantes de limites. |
| `openspec/specs/` e `openspec/changes/` | Decisão e comportamento | Requisitos e cenários de comportamento do produto, decisões técnicas e histórico de mudanças. |
| [`docs/azyboard-wiki/`](azyboard-wiki/) | Uso do produto | Passo a passo para pessoas usarem o Azy Board. |
| [`README.md`](../README.md) | Arquitetura e início rápido | Visão geral, stack, arquitetura e primeiros passos. |
| [`CHANGELOG.md`](../CHANGELOG.md) | Histórico | O que mudou em cada versão. |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Padrões de engenharia | Convenções, fluxo de PR e definição de pronto. |
| [`TESTING.md`](../TESTING.md) | Estratégia de testes | Níveis, comandos e política de testes. |
| [`DEPLOY.md`](../DEPLOY.md) | Deploy | Procedimentos de publicação e operação. |

## Artefatos gerados (não editar)

Os fatos voláteis abaixo são **gerados do runtime** por `bun run generate:docs`.
Não edite os arquivos manualmente nem replique seus valores em outros documentos.

| Artefato | Origem |
|---|---|
| [`generated/assistant-limits.md`](generated/assistant-limits.md) | `packages/types/src/assistantLimits.ts` |
| [`generated/openapi.json`](generated/openapi.json) | `apps/api/src/validation.ts` |
| `apps/mcp/README.md` (bloco do catálogo) | `apps/mcp/src/registry.ts` |

## Verificação

`bun run check:docs` falha quando um artefato gerado está desatualizado, um link
interno está quebrado ou um documento de produto contém uma afirmação
sabiamente incorreta. Rode `bun run generate:docs` para atualizar os artefatos.

## Referências específicas

- [`docs/AI_AGENT_DATA_POLICY.md`](AI_AGENT_DATA_POLICY.md) — dados e privacidade do Azy Agent.
- [`docs/error-contract.md`](error-contract.md) — envelope de erro da API.
- [`docs/db-integrity.md`](db-integrity.md) — integridade e cascatas do banco.
- [`docs/ci.md`](ci.md) — integração contínua.
- [`docs/ANALISE-SISTEMA.md`](ANALISE-SISTEMA.md) — auditoria técnica (documento de análise, cita divergências de propósito).
