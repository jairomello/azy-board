## 1. Schema aditivo e contratos

- [x] 1.1 Definir tipos compartilhados dos dez boxes, filtros, cobertura e detalhamentos.
- [x] 1.2 Adicionar `project_analytics_coverage`, `item_events` e índices com comentários `[TENANT]` e `[DB-SWAP]` aplicáveis.
- [x] 1.3 Adicionar `sprint_cycles` e `sprint_cycle_items` com fonte, timestamps e motivo de encerramento.
- [x] 1.4 Deduplicar `item_sprints` auditavelmente e adicionar `UNIQUE(itemId, sprintId)` antes das agregações.
- [x] 1.5 Criar migração idempotente que registra cobertura/ciclo inclusive para projeto e sprint vazios, usando `itemId` nulo apenas no baseline de projeto e sem alterar payloads existentes.
- [x] 1.6 Definir cascade/limpeza de analytics ao excluir projeto/tenant sem apagar eventos no hard delete de item.
- [x] 1.7 Testar migração sobre base vazia, base atual, duplicatas e sprint aberta/fechada/vazia.

## 2. Instrumentação histórica mínima

- [x] 2.1 Implementar serviço transacional append-only com snapshots mínimos e isolamento tenant/projeto.
- [x] 2.2 Instrumentar criação, status/coluna, pontos, tipo, sprint, versão, módulo/reparenting, arquivo, restauração e exclusão.
- [x] 2.3 Registrar eventos por item em subárvores/cascatas e `LEAF_CHANGED` para pais afetados, incluindo conversões SIMPLE/HIERARCHICAL.
- [x] 2.4 Cobrir UI, REST, MCP, batch e Shadow Markdown sem alterar respostas existentes.
- [x] 2.5 Preservar eventos após exclusão de item e impedir conteúdo desnecessário nos snapshots.
- [ ] 2.6 Testar atomicidade, ordem estável, idempotência por correlationId e regressão das mutações existentes.
- [ ] 2.7 Implementar corte de ativação sem writers antigos entre baseline e dual-write.
- [x] 2.8 Criar cobertura atomicamente no `POST /projects` e testar projeto vazio/itens provisionados.

## 3. Ciclos de sprint

- [x] 3.1 Iniciar ciclo OPENED atomicamente, inclusive com zero itens, capturando tipo, folha, pontos, status, módulo e versão.
- [x] 3.2 Encerrar ciclo anterior como SUSPENDED ao trocar sprint aberta e como CLOSED ao fechar.
- [x] 3.3 Criar ciclo MIGRATION parcial somente para sprint aberta no deploy.
- [x] 3.4 Preservar ciclos anteriores e criar novo ciclo ao reabrir sprint suspensa como PROPOSED.
- [x] 3.5 Impedir reconstrução de sprint fechada legada e preservar snapshots após hard delete de item.
- [x] 3.6 Testar lifecycle, troca/reabertura, ciclo vazio, migração e compromisso não concluído.

## 4. API e cálculos

- [x] 4.1 Implementar população de folhas antes dos filtros e roll-up sem dupla contagem.
- [x] 4.2 Implementar Progresso/Escopo, WIP, Bloqueados, Atrasados e Versões com dados atuais.
- [x] 4.3 Implementar Carga da Equipe com `blockedSubset <= wipTotal` e itens sem responsável, sem ranking.
- [x] 4.4 Implementar Horas Registradas sobre logs manuais, usando autor/squad atual do autor e filtro de sprint por `EXISTS`, sem breakdown aditivo.
- [x] 4.5 Implementar Burnup diário UTC com população dinâmica, DONE, archive/unarchive/delete e ordem estável.
- [x] 4.6 Implementar Aging WIP por episódio ativo atual, incluindo archive/restauração, e limite inferior legado.
- [x] 4.7 Implementar box Sprint por ciclo com compromisso, escopo no corte, concluído e compromisso não concluído.
- [x] 4.8 Criar endpoints agregados com `requireRole('VIEWER')`, filtros aplicáveis e limites de período.
- [x] 4.9 Testar matriz de filtros, fórmulas, filhos/pais, SIMPLE/HIERARCHICAL, IDOR, tenant e dados parciais.

## 5. Dashboard frontend

- [x] 5.1 Adicionar rota lazy e item Dashboard no `AppShell` após disponibilidade da API.
- [x] 5.2 Criar filtros independentes por período, módulo, sprint, versão, squad, responsável e tipo.
- [x] 5.3 Implementar os dez boxes e estados loading, vazio, erro, parcial e filtro inaplicável.
- [x] 5.4 Implementar burnup SVG/CSS com tabela equivalente e detalhamento objetivo.
- [x] 5.5 Implementar listas de WIP, bloqueados, atrasados e aging com abertura do item.
- [x] 5.6 Garantir layout responsivo, teclado, ARIA, contraste e informação não dependente de cor.
- [x] 5.7 Revalidar snapshot após eventos relevantes, reconexão e retorno de foco.

## 6. Qualidade e documentação

- [x] 6.1 Adicionar traduções PT-BR, EN e ES para boxes, filtros e cobertura.
- [x] 6.2 Criar testes frontend de rota/menu, filtros, dez boxes, acessibilidade e ausência de finanças/IA/WIP limit/P85/CFD/throughput/lead-cycle.
- [x] 6.3 Atualizar wiki, matriz de funcionalidades, modelo de dados, API e changelog.
- [x] 6.4 Documentar semântica de horas registradas, aging legado e cobertura histórica.
- [x] 6.5 Executar `bun run check` e teste de migração/regressão antes de liberar o menu.
