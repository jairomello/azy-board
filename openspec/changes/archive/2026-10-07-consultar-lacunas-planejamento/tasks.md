Board ref: 5f3152ad-3d27-4a12-8c49-db79d0f631e2

## 1. Consulta tipada

- [ ] 1.1 Definir `query_planning_gaps` com expressão ALL/ANY, campos/operadores allowlisted, limites de profundidade/condições/página e resposta de total/grupos/snapshot no catálogo compartilhado.
- [ ] 1.2 Implementar normalização de `me`, datas relativas com referência/fuso e distinção entre null no envelope e IS_EMPTY, sem alterar compatibilidade de `list_tasks`.
- [ ] 1.3 Definir modelo/port de snapshot de leitura com ator/tenant/projeto, revisão, expiração de 30 minutos e máximo de 10.000 IDs; alinhar correções ao contrato T38 sem duplicar idempotência/outbox.

## 2. Resolução e persistência

- [ ] 2.1 Implementar avaliação consistente nos adapters SQLite/PostgreSQL para NULL, zero pontos, todos os vínculos de sprint e usuário/API key; aplicar Leaf Rule e escopo padrão retornado explicitamente.
- [ ] 2.2 Resolver e guardar população/revisões/valores relevantes em snapshot consistente, implementar cursor estável vinculado e expiração, com erros explícitos para limite e acesso revogado.
- [ ] 2.3 Calcular total distinto, grupos sobrepostos rotulados e combinações exclusivas sem contar ancestrais nem somar grupos como total; implementar consultas em lote.
- [ ] 2.4 Expor leitura autorizada por rota e adaptadores MCP/agente, com comentários `[TENANT]` e `[DB-SWAP]` pertinentes e sem aceitar predicados SQL/textuais livres.

## 3. Board e correção

- [ ] 3.1 Adicionar `open_planning_result` somente ao assistente/contratos de UI, reaproveitando transporte, commandId, aba de origem e checkpoint de T17/T18.
- [ ] 3.2 Integrar camada de recorte por resultId no board/árvore e store de visão, com contagem, expressão, captura, ancestrais separados e diferença explícita de itens não apresentáveis no Kanban.
- [ ] 3.3 Preparar correções por grupo/IDs usando `update_items`, com valores confirmados, deduplicação, detecção de alterações contraditórias e pré-condições de revisão no commit.
- [ ] 3.4 Integrar correções a T38 para replay/outbox; impedir matchAll ou reconsulta de população após aprovação e informar conflitos antes de nova prévia.
- [ ] 3.5 Documentar no catálogo/skill a proibição de inventar prazos/pontos/atribuições e traduzir rótulos da interface PT-BR/EN/ES.

## 4. Verificação

- [ ] 4.1 Testar ALL/ANY combinados, datas inválidas, zero/null, sprint CLOSED histórica e API key responsável nos dois adapters.
- [ ] 4.2 Testar grupos sobrepostos, mais de uma página, captura com mudança concorrente, expiração, limite e resultId de outro ator/tenant.
- [ ] 4.3 Testar abertura OR na aba correta, replay de comando e restauração de visão, sem transformar OR em AND.
- [ ] 4.4 Testar correção vazia, valores desconhecidos, revisão divergente, IDs sobrepostos e retry T38 sem atingir cards fora do grupo.
- [ ] 4.5 Executar `bun run check`, `bun run test:smoke` e `bun run test:agent-skill` se a skill for alterada; verificar jornada de consulta → grupos → board → aprovação delimitada.
