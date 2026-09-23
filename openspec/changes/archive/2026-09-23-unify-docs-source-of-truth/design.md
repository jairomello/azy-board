## Context

O repositório tem hoje várias fontes para os mesmos fatos voláteis. Além do README, `docs/`, 78 páginas de wiki, `apps/mcp/README.md`, `DEPLOY*`, `TESTING.md` e `CONTRIBUTING.md`, os próprios limites do Azy Agent estão duplicados no código: `apps/api/src/routes/assistant.ts` (`defaultGovernance`), `apps/api/src/services/assistantHarness.ts` (`HARNESS_LIMITS`) e `apps/web/src/components/RootAssistantSettings.tsx` (defaults do formulário). O README publica uma quarta versão ("4 steps, 8 tool calls, 45 segundos, 50 KB"). Já existem peças aproveitáveis: o runtime serve OpenAPI em `/openapi.json` (`openApiDocument()` em `validation.ts`), o catálogo MCP é verificado contra `apps/mcp/README.md` por `scripts/check-mcp-catalog.ts`, e `scripts/build-azy-knowledge-pack.ts` gera um pack a partir de `assistantKnowledge.ts`.

Restrições: PT-BR; dependências apenas MIT/Apache-2.0/BSD/ISC/domínio público; sem impacto no comportamento de produção além da extração de constantes; wiki é grande (78 arquivos) e não deve ser reescrita por completo nesta change.

## Goals / Non-Goals

**Goals:**
- Uma fonte única por tipo de fato: runtime para contratos, OpenSpec para decisão/comportamento, wiki para uso, README para arquitetura/início rápido, CHANGELOG para histórico.
- Artefatos voláteis (catálogo MCP, OpenAPI, tabelas de limites) gerados do runtime, com cabeçalho de origem e comando de regeneração.
- Um único módulo de constantes de limites consumido por API, web e geração de docs.
- Gate de integridade de documentação no CI: gerados em dia, links internos válidos e ausência de afirmações proibidas.
- Correção das divergências conhecidas (limites, CSV, aprovação, SQLite/PostgreSQL).
- Revisão de docs na definição de pronto.

**Non-Goals:**
- Reescrever a wiki inteira ou o README.
- Adotar um gerador de site (VitePress, Docusaurus, MkDocs).
- Verificar URLs externas (evita flakiness de rede).
- Traduzir ou reorganizar as pastas da wiki.
- Gerar toda a documentação; apenas os fatos voláteis passam a ser derivados.

## Decisions

### 1. Módulo único de constantes de limites
Criar `packages/types/src/assistantLimits.ts` (re-exportado por `@azy-board/types`) com `DEFAULT_GOVERNANCE`, `GOVERNANCE_BOUNDS`, `HARNESS_LIMITS`, `MAX_MESSAGE_BYTES` e `MAX_ASSISTANT_ACTIONS`. API (`assistant.ts`, `assistantHarness.ts`), web (`RootAssistantSettings.tsx`) e o gerador de docs passam a importar daqui. Alternativas: manter em `apps/api` (o web continuaria duplicando) ou criar um novo pacote `@azy-board/config` (custo de workspace sem ganho imediato). A escolha preserva os valores atuais de `defaultGovernance` e é coberta por testes.

### 2. Gerados com cabeçalho e verificação por regeneração
Os artefatos gerados ficam em `docs/generated/`: `mcp-catalog.md`, `openapi.json` e `assistant-limits.md`. Cada arquivo começa com um aviso "GERADO AUTOMATICAMENTE — não editar; rode `bun run generate:docs`". O verificador `check:docs` regenera em memória e compara com o versionado, falhando em divergência. Alternativa considerada: checar apenas os fatos numéricos por regex — frágil e não cobre o catálogo.

### 3. Catálogo MCP gerado dentro de `apps/mcp/README.md`
Para não quebrar consumidores existentes (`check-agent-skill.ts` lê `apps/mcp/README.md`), a seção de catálogo é gerada **in-place** entre marcadores `<!-- BEGIN GENERATED: mcp-catalog -->` e `<!-- END GENERATED: mcp-catalog -->`. O restante do README permanece manual. Alternativa: mover o catálogo para `docs/generated/` e ajustar todos os consumidores — mais disruptivo.

### 4. OpenAPI versionado a partir do runtime
`generate:openapi` importa `openApiDocument()` e escreve `docs/generated/openapi.json`. O README e a wiki referenciam o arquivo gerado em vez de descrever rotas manualmente. O endpoint `/openapi.json` continua existindo.

### 5. Não duplicar números em prosa; referenciar a tabela gerada
As afirmações numéricas de limites saem do README/wiki e passam a apontar para `docs/generated/assistant-limits.md`. O gate verifica que a tabela gerada bate com as constantes e que os documentos não reintroduzem números soltos nem frases proibidas (ex.: "toda mutação exige aprovação", "CSV import" sem funcionalidade correspondente). Isso ataca a causa (duplicação) e não só o sintoma.

### 6. Verificação de links internos
`check:docs` valida links relativos de Markdown (`[..](caminho)`) resolvendo contra o repositório e falhando quando o alvo não existe; âncoras e URLs externas são ignoradas. Implementação própria, sem dependência nova.

### 7. Papéis documentados em `docs/README.md`
Um índice curto define o papel de cada fonte e o que pertence a cada uma, servindo de guia de decisão para quem escreve. Referenciado pelo `CONTRIBUTING.md`.

### 8. Definição de pronto
Adicionar ao checklist de PR do `CONTRIBUTING.md`: "Documentação: contratos voláteis atualizados via geradores e `bun run check:docs` verde".

## Risks / Trade-offs

- [Constantes com valores divergentes hoje] → o módulo único fixa o valor efetivo (`defaultGovernance`) e testes garantem que o runtime não muda de comportamento; a divergência do web é corrigida junto.
- [Arquivos gerados geram ruído em diffs] → são determinísticos e só mudam quando o runtime muda; o cabeçalho explica a origem.
- [Gate de links com falsos positivos] → só links relativos de arquivo; âncoras e externos ignorados.
- [Afirmações proibidas podem ser necessárias em contexto] → a lista é pequena, revisável e configurável em um ponto único.
- [Escopo da wiki] → esta change corrige as divergências conhecidas e adiciona links para os gerados; não reescreve as 78 páginas.
- [Pack de conhecimento do agente referencia docs] → ao mover conteúdo, atualizar `assistantKnowledge.ts`/`build-azy-knowledge-pack.ts` e o `sha256` correspondente.

## Migration Plan

1. Extrair o módulo de constantes e migrar API e web para ele, com testes.
2. Implementar os geradores (`generate:mcp-catalog`, `generate:openapi`, `generate:limits`) e o agregador `generate:docs`; versionar os artefatos.
3. Implementar `check:docs` (regeneração, links, afirmações proibidas) e integrar a `check`/`regression`/CI.
4. Corrigir README, wiki, `DEPLOY.md` e referências divergentes; criar `docs/README.md`.
5. Atualizar `CONTRIBUTING.md` (papéis + definição de pronto) e `docs/ci.md`.

Rollback: remover o job de CI e os scripts; os artefatos gerados podem ser revertidos. As constantes extraídas preservam os valores atuais.

## Open Questions

- Vale adotar um site de docs (ex.: VitePress) em uma change futura, agora que os fatos voláteis são gerados?
- A wiki deve ser parcialmente derivada das specs OpenSpec (ex.: seções de comportamento) ou permanece 100% autoral para uso do produto?
- `check:docs` deve ser bloqueante desde o início ou iniciar em modo observação, como a regressão visual?
