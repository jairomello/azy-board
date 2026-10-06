Board ref: 503e5a70-32a0-4de0-a78d-cb52f4b9c958

## Context

`routes/dashboard.ts` usa `persistence.dashboard` para população, cobertura e eventos; burnup sem filtro usa `persistence.analytics.readProjectRollup`, enquanto filtrado lê eventos desde a cobertura e reconstitui estado. `services/dashboardMetrics.ts` mantém delta diário e recomputação completa; ainda importa SQLite, assunto de T36. Spec `dashboard-metric-rollups` permite replay filtrado incremental e limita período a 366 dias. O histórico `2026-10-05-agent-dashboard-metrics` exige paridade tela/agente, filtros aplicados/inaplicáveis e WIP que inclui bloqueados. Não há medição de grande volume disponível nesta revisão.

## Goals / Non-Goals

**Goals:** orçamento reproduzível de leitura; custo limitado nos caminhos comuns; detalhes paginados sem alterar totais ou semântica histórica.

**Non-Goals:** ranking de pessoas, novas métricas, cache como fonte de verdade, correção de boot ADVANCED, outbox, alteração da regra de cobertura ou migração entre perfis.

## Decisions

### Metas propostas antes da otimização

Adotar inicialmente, como propostas de aceite a medir:

| Perfil | Projeto alvo | Histórico | Concorrência HTTP | p95 snapshot/aging/hours/sprint | p95 burnup até 366 dias | Aumento máximo RSS da API na carga |
|---|---|---|---|---|---|---|
| SIMPLE | 10 mil folhas + 2 mil agregadores | 100 mil eventos | 5 | 500 ms | 1.000 ms | 256 MiB |
| ADVANCED | 100 mil folhas + 20 mil agregadores | 1 milhão de eventos | 20 | 750 ms | 1.500 ms | 512 MiB |

Referência proposta: Linux, 4 vCPU, 8 GiB RAM, SSD local; PostgreSQL/Valkey em serviços na mesma máquina ADVANCED, versões do deploy fixadas. Seed determinística com dois tenants, múltiplos projetos, reabertura, mudança de filtro, arquivamento/exclusão, logs manuais e cobertura parcial. Executar 30 s de aquecimento e três rodadas de 120 s por endpoint/recorte, requests autenticadas, relatório por rodada sem média que esconda violação. Registrar commit, seed, hardware, versões, p50/p95/p99, erros, RSS basal/pico, bytes e queries/plans; observar partida fria separadamente. Nenhum número desta tabela é medição existente. Alteração de meta exige decisão versionada, não relaxamento automático.

### Agregados SQL em ports, não todos os itens no handler

Adicionar métodos agregados em `persistence/ports.ts` implementados nos adapters SQLite/PostgreSQL definidos por T36. Encaminhar filtros parametrizados, tenant/projeto/ator, agrupamentos e últimas transições em consultas constantes; evitar consulta por item. Snapshot/aging usam estado atual; hours soma somente logs manuais com duração positiva pelo autor. Índices seguem plano medido, não índice indiscriminado em todas as combinações. Retenção/cobertura permanecem explícitas. Alternativa de apenas cache mascara custo e invalidação incorreta.

### Projeção histórica de dimensões

Manter o rollup sem filtros. Para burnup filtrado, recomendar projeção diária de deltas por tupla de dimensões históricas aplicáveis (módulo/sprint/versão/tipo), com índices por tenant/projeto/data e checkpoints periódicos. Não materializar o produto cartesiano de filtros: agregar tuplas existentes e combinar predicados na leitura. Atualização transacional pelo contrato de analytics de T38 registra saída/entrada quando dimensões ou Leaf Rule mudam. Checkpoint no início do período evita replay desde a baseline em cada leitura. Reconstrução idempotente em lotes e checagem com replay de referência fora do hot path; estados que não tinham dimensão conhecida continuam seguindo o comportamento anterior e a cobertura parcial. Usar atributos atuais para evento passado foi rejeitado por alterar números. Projeção atrasada/incompleta exige aviso ou fallback limitado documentado, nunca apresentar zero como histórico completo.

### Detalhes limitados e compatíveis

O código real usa `sprintIds?: string[]` no snapshot histórico e predicado `some/includes` para seleção múltipla. A projeção deve representar o conjunto histórico de sprints (ou relação temporal normalizada com deduplicação por item), não somar uma cópia por sprint: um item em duas sprints selecionadas conta uma vez. Filtros CSV de módulo/versão/tipo também mantêm união dentro da dimensão e interseção entre dimensões. Esse caso precisa fixture própria antes do backfill.

Propor padrão 50 e máximo 100 itens/linhas por página, cursor opaco vinculado a tenant/projeto/filtros/ordenação e desempate por ID. Campos atuais continuam; adicionar `nextCursor`, `hasMore`, `truncated` e total quando aplicável. Snapshot retorna amostras limitadas e aponta para detalhe paginado; aging/hours/sprint paginam listas, preservando agregados completos. Limite proposto 256 KiB de JSON por resposta comum; séries com até 366 dias não são truncadas silenciosamente. API, `ProjectDashboardPage.tsx` e tool de métricas evoluem juntos. Cursor inválido ou usado noutro recorte retorna validação, nunca vaza dados. Alternativa de cortar tudo em memória ainda aloca a população inteira.

## Risks / Trade-offs

- [Cardinalidade de tuplas históricas] → medir armazenamento/write amplification; checkpoint e índices dirigidos por plano; evitar cubos combinatórios.
- [Drift ou backfill incompleto] → marca de progresso/versionamento de projeção, comparação com oráculo e rebuild idempotente; manter avisos de cobertura.
- [Cursor sob mutação concorrente] → ordenar estavelmente, declarar captura e reiniciar consulta quando necessário; não prometer snapshot global sem suporte transacional.
- [Ruído de benchmark CI] → gates de queries/semântica em PR e ambiente fixo para orçamento temporal, três rodadas com artefatos; resultado fora da referência é informativo.
- [T36 indisponível] → desenvolver modelo/seed local, mas aceite ADVANCED depende de boot real, não de mock.

## Migration Plan

Após T36/T38, acrescentar migrations aditivas por perfil, fazer backfill por projeto em lotes com checkpoint retomável e validar drift antes de ativar leitura otimizada. Canary por projeto compara leituras sem executar duas escritas. Reverter leitura para caminho anterior preservando tabelas adicionais; não apagar histórico nem trocar perfil. Instrumentar custo do fallback e não declará-lo conforme ao orçamento se repetir replay integral.

## Open Questions

Metas e hardware acima são decisão inicial recomendada; a tarefa de baseline confirmará viabilidade com evidência. Não há resultado de benchmark presumido. Coordenar localização do adaptador de tool com T40 sem duplicar cálculo.
