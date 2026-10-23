# Documentação do Azy Board

Este índice define o papel de cada fonte de documentação. A regra central é
**não duplicar fatos voláteis**: quando um fato tem fonte derivável no runtime,
os documentos referenciam o artefato gerado em vez de repeti-lo.

## Fontes e papéis

| Fonte | Papel | O que pertence aqui |
|---|---|---|
| Código, schema e runtime | Fonte dos contratos | Tipos, schemas de validação, registry de ferramentas MCP, constantes de limites. |
| `openspec/specs/` e `openspec/changes/` | Decisão e comportamento | Requisitos e cenários de comportamento do produto, decisões técnicas e histórico de mudanças. |
| [`docs/azyboard-wiki/`](azyboard-wiki/) | Uso do produto | Passo a passo para pessoas usarem o Azy Board. É a fonte da central de ajuda (`/help`) e da documentação consultada pelo Azy Agent. |
| [`README.md`](../README.md) | Arquitetura e início rápido | Visão geral, stack, arquitetura e primeiros passos. |
| [`CHANGELOG.md`](../CHANGELOG.md) | Histórico | O que mudou em cada versão. |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | Padrões de engenharia | Convenções, fluxo de PR e definição de pronto. |
| [`TESTING.md`](../TESTING.md) | Estratégia de testes | Níveis, comandos e política de testes. |
| [`DEPLOY.md`](../DEPLOY.md) | Deploy | Procedimentos de publicação e operação. |
| [`release-evidence.md`](release-evidence.md) e [`release-evidence.json`](release-evidence.json) | Evidência de release | Matriz por perfil/check, estado verificado/limitado/pendente, comando, SHA, data e limitações observadas. |

## Artefatos gerados (não editar)

Os fatos voláteis abaixo são **gerados do runtime** por `bun run generate:docs`.
Não edite os arquivos manualmente nem replique seus valores em outros documentos.

| Artefato | Origem |
|---|---|
| [`generated/assistant-limits.md`](generated/assistant-limits.md) | `packages/types/src/assistantLimits.ts` |
| [`generated/openapi.json`](generated/openapi.json) | `apps/api/src/validation.ts` |
| `apps/mcp/README.md` (bloco do catálogo) | `packages/tool-registry/src/registry.ts` |

## Central de ajuda

A central de ajuda (`/help`, autenticada) e o Azy Agent servem o manual funcional
a partir da wiki versionada. O escopo exposto — módulos `00`–`09` e a capa
`Home.md`, com exclusão de `controle/`, `modelos/`, `.obsidian/` e das seções
técnicas recolhíveis (`<details>`) — é declarado em um único ponto:
`apps/api/src/services/helpContent.ts`. Nenhum outro ponto mantém uma lista
própria do que é exposto, e a verificação automatizada falha se o conteúdo
servido divergir dessa definição.

## Verificação

`bun run check:docs` falha quando um artefato gerado está desatualizado, um link
interno está quebrado ou um documento de produto contém uma afirmação
sabiamente incorreta. Rode `bun run generate:docs` para atualizar os artefatos.

## Referências específicas

- [`docs/AI_AGENT_DATA_POLICY.md`](AI_AGENT_DATA_POLICY.md) — dados e privacidade do Azy Agent.
- [`docs/error-contract.md`](error-contract.md) — envelope de erro da API.
- [`docs/db-integrity.md`](db-integrity.md) — integridade e cascatas do banco.
- [`docs/dashboard-performance.md`](dashboard-performance.md) — benchmark, metas e operação das projeções do Dashboard.
- [`docs/board-drag-animation.md`](board-drag-animation.md) — contrato do movimento do arraste de cards (vaga de destino, deslizamento, assentamento e reversão).
- [`docs/ci.md`](ci.md) — integração contínua.
- [`docs/release-evidence.md`](release-evidence.md) — garantias, evidências e limites por perfil e release.
- [`docs/ANALISE-SISTEMA.md`](ANALISE-SISTEMA.md) — auditoria técnica (documento de análise, cita divergências de propósito).
