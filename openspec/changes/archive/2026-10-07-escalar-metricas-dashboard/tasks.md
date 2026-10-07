Board ref: 503e5a70-32a0-4de0-a78d-cb52f4b9c958

## 1. Baseline e contrato de desempenho

- [x] 1.1 Confirmar runtime real T36 `corrigir-inicializacao-advanced` e alimentação transacional T38 `garantir-mutacoes-idempotentes-transacionais`; alinhar adaptador de tool com T40 sem recálculo paralelo.
- [x] 1.2 Criar seed determinística descartável dos volumes SIMPLE/ADVANCED propostos, com tenants, filtros/histórico e cobertura parcial representativos.
- [x] 1.3 Criar runner autenticado por endpoint/recorte com aquecimento, três rodadas, hardware/versões/SHA/seed, p50/p95/p99, RSS, bytes, erros e query plans.
- [x] 1.4 Medir baseline real na referência e registrar gargalos; confirmar ou revisar metas em decisão versionada sem apresentar proposta como resultado medido.
- [x] 1.5 Construir oráculo pequeno de semântica histórica e matriz dos filtros aplicáveis/inaplicáveis, vazio, Leaf Rule, WIP e horas manuais.

## 2. Consultas agregadas

- [x] 2.1 Adicionar ports de agregação snapshot/carga e implementar SQL tenant/projeto/ator nos adapters SIMPLE/ADVANCED com comentários `// [TENANT]` e `// [DB-SWAP]` pertinentes.
- [x] 2.2 Otimizar aging/últimas transições e hours/autor do log com consultas constantes e linhas de detalhe limitadas.
- [x] 2.3 Otimizar sprint/ciclos mantendo snapshots/regras de cobertura e agregados completos.
- [x] 2.4 Medir planos e acrescentar somente índices justificados por perfil, com migrations idempotentes/paridade.

## 3. Burnup histórico limitado

- [x] 3.1 Modelar projeção por tuplas históricas de módulo/sprint/versão/tipo e checkpoints, preservando rollup sem filtros e limite de período de 366 dias.
- [x] 3.2 Implementar atualizações por saída/entrada de dimensão/Leaf Rule na transação de analytics de T38 sem criar outbox concorrente.
- [x] 3.3 Implementar backfill em lotes retomável, versionado e idempotente com marca de prontidão por projeto.
- [x] 3.4 Comparar projeção ao oráculo/replay fora do hot path para reabertura, exclusão, arquivamento, mudança de dimensão e cobertura incompleta.
- [x] 3.5 Trocar leitura filtrada por projeção/checkpoint limitado e definir fallback/avisos quando a projeção não está pronta, sem zero enganoso.
- [x] 3.6 Validar representação histórica de conjuntos `sprintIds` com fixture de item em duas sprints selecionadas, sem contagem duplicada e com união/interseção dos filtros CSV preservadas.

## 4. Detalhes e consumidores

- [x] 4.1 Implementar cursor validado por escopo/filtros/ordem, padrão 50/máximo 100, metadados aditivos e desempate por ID para aging/hours/sprint e detalhe de snapshot.
- [x] 4.2 Atualizar `ProjectDashboardPage.tsx` e adaptador de métricas do agente para continuidade/truncamento, preservando critérios, totais e sobreposição.
- [x] 4.3 Testar cursor inválido/cross-tenant/cross-filtro, fronteiras de página, mutação concorrente e respostas de até 256 KiB sem truncamento silencioso de série.

## 5. Aceite e operação

- [x] 5.1 Adicionar gates determinísticos anti-N+1/hidratação integral/replay desde baseline e paridade SQL/semântica em ambos os perfis.
- [x] 5.2 Reexecutar benchmark completo na referência e publicar cada rodada contra metas, incluindo RSS e custo de backfill/cardinalidade das projeções; no ADVANCED, usar PostgreSQL com pelo menos 1 GiB em `/dev/shm` (`shm_size` do Compose) e validar concorrência sem erros. O relatório ADVANCED registra FAIL de latência, portanto não é aceite de desempenho.
- [x] 5.3 Documentar resultados reais, limites, comandos, canary por projeto e rollback de leitura sem remover histórico/projeções.
- [x] 5.4 Na futura implementação, executar `bun run check`, `bun run test:smoke` e testes ADVANCED/migrations; só aceitar desempenho com evidência real dos dois perfis.
