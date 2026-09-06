## Context

O produto já persiste itens, hierarquia, pontos, status, colunas, datas planejadas, sprints, versões, responsáveis, squads e duração opcional em logs manuais. Esses dados sustentam uma fotografia operacional útil. Burnup e aging WIP, porém, não podem ser reconstruídos com confiança por `updatedAt`, eventos WebSocket efêmeros ou texto livre.

A revisão reduz o Dashboard de 17 boxes inicialmente mapeados para 10 boxes, aproximadamente 60%. O corte privilegia uso comum, clareza gerencial, dados já disponíveis e baixo impacto sobre formulários e schema.

## Goals / Non-Goals

**Goals:**

- Entregar uma visão por projeto com dez boxes objetivos e detalháveis.
- Reutilizar dados e formulários existentes sempre que possível.
- Introduzir apenas o histórico mínimo para burnup, aging e baseline de sprint.
- Manter a Leaf Rule, multi-tenancy, RBAC, i18n, acessibilidade e responsividade.
- Implantar de forma aditiva, sem quebrar rotas, payloads ou registros existentes.

**Non-Goals:**

- Incluir qualquer informação financeira ou monetária.
- Criar cadastro de capacidade, disponibilidade, WIP limit, severidade de bug ou timesheet.
- Implementar burndown, churn isolado, CFD, throughput, lead/cycle time ou previsões probabilísticas.
- Gerar avaliação qualitativa, semáforo de saúde, “ações prioritárias” ou recomendação por IA.
- Usar pontos, horas ou quantidade de itens como ranking individual ou comparação de produtividade entre squads.

## Decisions

### 1. Priorização dos 60%

| Box avaliado | Decisão | Motivo |
|---|---|---|
| Progresso e Escopo | Manter | Leitura executiva central; dados atuais |
| WIP | Manter | Métrica Kanban básica; dados atuais |
| Bloqueados | Manter | Impedimento acionável; dados atuais |
| Atrasados | Manter | Risco de prazo objetivo; dados atuais |
| Burnup | Manter | Separa entrega de crescimento do escopo; exige histórico mínimo |
| Aging WIP | Manter | Identifica trabalho envelhecido; exige início observado |
| Sprint | Manter | Uso comum e alinhado ao lifecycle existente |
| Versões | Manter | Acompanha releases com dados atuais |
| Carga da Equipe | Manter | Mostra distribuição atual sem ranking |
| Horas Registradas | Manter | Reutiliza duração já informada nos logs |
| Burndown | Cortar | Redundante com burnup e sensível a mudança de escopo |
| Churn isolado | Cortar | Burnup já evidencia variação de escopo |
| CFD | Cortar | Alto custo histórico/visual para a primeira entrega |
| Throughput | Cortar | Útil, mas menos prioritário que aging no primeiro recorte |
| Lead/Cycle time | Cortar | Exige mais regras e histórico de transições |
| Qualidade/Bugs separado | Cortar | Tipo BUG continua filtrável nos boxes mantidos |
| Capacidade configurável | Cortar | Exigiria novos campos, governança e interpretação de disponibilidade |

### 2. Sem novos formulários

Nenhum box exige entrada nova do usuário. Sprint e versão continuam nos fluxos atuais; pontos, responsável, datas e bloqueio continuam na modal do item; horas continuam no log manual com `durationMin`.

Não será criado `time_entries` nesta etapa. O box **Horas Registradas** soma somente logs `manual` com duração positiva, usando `createdAt` como data do apontamento. A UI informa que se trata de horas registradas, não de horas efetivamente ocorridas em uma data contábil.

### 3. Modelo aditivo mínimo

Criar `project_analytics_coverage` para representar o início da cobertura mesmo em projeto vazio. Criar `item_events` append-only com eventos estritamente necessários: baseline, criação, mudança de status/coluna, pontos, tipo, sprint, versão, módulo/reparenting, arquivamento, restauração e exclusão. Cada evento guarda tenant, projeto, item, sequência estável, instante UTC, ator/origem e snapshots anterior/posterior de `parentId`, tipo, condição de folha, status, pontos, conjunto deduplicado de sprintIds, versão e módulo efetivo.

Quando criação, exclusão ou reparenting altera a condição de folha dos pais antigo/novo, o serviço grava também a transição analítica de cada item afetado. Reparenting registra mudança de módulo efetivo para todas as folhas descendentes reclassificadas; archive/unarchive/delete em cascata registra um evento para cada item afetado. Conversões SIMPLE/HIERARCHICAL usam o mesmo serviço.

Adicionar `sprint_cycles` com `startedAt`, `endedAt`, `endReason = SUSPENDED|CLOSED` e fonte `OPENED|MIGRATION`, além de `sprint_cycle_items`. O ciclo existe mesmo com zero itens. Para preservar o comportamento atual, abrir outra sprint encerra o ciclo ativo anterior como `SUSPENDED`, rebaixa sua sprint para `PROPOSED` e inicia novo ciclo; reabrir cria outro ciclo sem sobrescrever os anteriores. Fechar sprint encerra o ciclo como `CLOSED`.

Como `item_sprints` é N:N, a migração deduplica pares repetidos antes de criar `UNIQUE(itemId, sprintId)`; eventos guardam conjunto de sprintIds. Essa deduplicação é a única transformação controlada de dado existente e é auditada. Nenhum campo existente se torna obrigatório.

Alternativa rejeitada: adicionar `startedAt`/`completedAt` em `items`. Isso duplicaria estado derivável e não resolveria mudança de escopo do burnup.

### 4. Cobertura sem história inventada

Na migração, cada projeto recebe `coverageStartedAt` e baseline do estado corrente, inclusive projeto vazio. Itens já ativos não recebem início real fictício: seu aging aparece como “pelo menos desde o início da cobertura” durante o episódio ativo corrente. Sprints abertas recebem baseline `MIGRATION`, explicitamente parcial; sprints fechadas legadas não recebem compromisso reconstruído.

### 5. Definições dos boxes

- **Progresso e Escopo:** folhas `TASK`/`BUG` não arquivadas; progresso por quantidade e por pontos, sempre com cobertura de estimativa.
- **WIP:** folhas nos status `IN_PROGRESS` e `BLOCKED`, distribuídas por coluna/status atual; sem limite configurável.
- **Bloqueados:** folhas com status `BLOCKED`, mostrando `blockedReason`, responsável e tempo observado quando disponível.
- **Atrasados:** folhas não concluídas/canceladas com `dueDate` anterior à data corrente; `dueDate` é data sem hora.
- **Burnup:** estado ao fim de cada dia UTC; escopo é a população dinâmica de folhas `TASK`/`BUG` não arquivadas e concluído significa `DONE`. Criação/restauração aumentam escopo; arquivo/exclusão reduzem; eventos com mesmo instante usam sequência/id estável.
- **Aging WIP:** idade do episódio ativo atual. `IN_PROGRESS ↔ BLOCKED` não zera; saída para `NOT_STARTED`, `DONE`, `CANCELLED` ou `ARCHIVED` encerra o episódio; restaurar diretamente para estado ativo inicia novo episódio. Ativos no baseline usam idade mínima conhecida.
- **Sprint:** compromisso é o conjunto de folhas do ciclo selecionado; escopo atual usa o corte `min(agora, cycle.endedAt)`; concluído é `DONE` nesse corte; compromisso não concluído é o baseline sem `DONE/CANCELLED` no fim do ciclo. O termo carry-over só é usado se houver associação posterior observada.
- **Versões:** escopo, pontos e progresso atuais por `versionId`; sem série histórica própria nesta fase.
- **Carga da Equipe:** `wipTotal` por squad/membro e `blockedSubset` como subconjunto não aditivo, além de itens sem responsável; não usa pontos como produtividade.
- **Horas Registradas:** soma de logs manuais com `durationMin > 0` por período, squad atual do autor e autor do log. Módulo/versão representam o agrupamento atual do item. Filtro de sprint usa `EXISTS`, sem breakdown aditivo por sprint, pois um item pode estar em múltiplas sprints.

### 6. Filtros e aplicabilidade

Filtros globais: período inclusivo em UTC (máximo definido pela API), módulo, sprint, versão, squad, responsável e tipo. A aplicabilidade é explícita:

| Box | Período | Módulo/Sprint/Versão/Tipo | Squad/Responsável |
|---|---|---|---|
| Progresso, WIP, Bloqueados, Atrasados, Versões | Não; estado “agora” | Sim, estado atual | Sim, assignee atual |
| Burnup | Sim | Sim, snapshots históricos | Não nesta fase |
| Aging WIP | Não; estado “agora” | Sim, estado atual | Sim, assignee atual |
| Sprint | Não se aplica; selecionar ciclo | Somente sprint/ciclo; módulo/versão/tipo não se aplicam | Não |
| Carga da Equipe | Não; estado “agora” | Sim, estado atual | Sim, assignee/squad atual |
| Horas Registradas | Sim, por `item_logs.createdAt` | Sim, agrupamento atual do item | Sim, autor e squad atual do autor |

Filtros inaplicáveis ficam desabilitados ou são declarados na resposta; nunca alteram silenciosamente um box. O rótulo do filtro pessoal em Horas é “Autor do log”, não “Responsável”.

### 7. API e roll-up

Criar endpoints agregados de snapshot e histórico com `requireRole('VIEWER')`. A detecção de folhas ocorre antes dos filtros para evitar que ocultar filhos transforme pai em folha. Pais agrupam, mas não são somados junto com descendentes. Toda query usa `tenantId + projectId`.

### 8. Rollout seguro

1. Aplicar migrações aditivas e validar schema no startup.
2. Gerar baseline corrente sem alterar itens/sprints existentes.
3. Ativar dual-write transacional de eventos e executar testes por UI, REST, MCP, batch e Shadow Markdown.
4. Publicar endpoints do Dashboard.
5. Exibir o item de menu somente após a API estar disponível.

Baseline e início da instrumentação ocorrem em um corte sem writers antigos: migration/startup termina antes de a instância aceitar tráfego, e nenhuma versão anterior permanece gravando. Rollback remove menu/rota primeiro e mantém tabelas aditivas. Falha ao gravar evento reverte somente a mutação corrente para não criar lacuna silenciosa.

Eventos e itens de ciclo não têm FK restritiva para item, mas pertencem ao projeto. Excluir item preserva histórico; excluir projeto/tenant remove cobertura, eventos e ciclos em cascade ou limpeza transacional explícita, sem bloquear as rotas atuais.

## Rastreabilidade dos Boxes

| Box | Para que serve | Atributos existentes utilizados | Atributos/tabelas ainda necessários | Migração/entrada em formulário |
|---|---|---|---|---|
| **Progresso e Escopo** | Mostrar conclusão por folhas e pontos | `items.type`, `status`, `points`, `parentId`, `ancestryPath` | Nenhum para fotografia | Nenhuma |
| **WIP** | Mostrar trabalho ativo por estado/coluna | `status`, `columnId`, `columns.baseStatus` | Nenhum | Nenhuma |
| **Bloqueados** | Listar impedimentos atuais | `status`, `blockedReason`, `assigneeId` | Evento de entrada em bloqueio para idade observada | Tabela `item_events`; sem campo novo |
| **Atrasados** | Evidenciar prazo planejado vencido | `dueDate`, `status`, `title`, `assigneeId` | Nenhum para fotografia | Nenhuma |
| **Burnup** | Comparar escopo total e concluído no tempo | Pontos/status/sprint/versão atuais | Baseline e eventos de criação, status, pontos, sprint e versão | `item_events` e baseline; sem formulário |
| **Aging WIP** | Mostrar idade do episódio ativo atual | Status/coluna atuais | Entrada observada do episódio e cobertura | `item_events`; sem formulário |
| **Sprint** | Comparar compromisso, atual, concluído e não concluído por ciclo | `sprints`, `item_sprints`, itens e pontos | `sprint_cycles` e `sprint_cycle_items` com snapshots | Tabelas aditivas; ações atuais capturam automaticamente |
| **Versões** | Acompanhar escopo e progresso por release | `project_versions`, `items.versionId`, status e pontos | Nenhum para fotografia | Nenhuma |
| **Carga da Equipe** | Mostrar distribuição de WIP/bloqueios | `memberships`, `squads`, `assigneeId`, status | Nenhum | Nenhuma |
| **Horas Registradas** | Consolidar esforço já informado | `item_logs.type`, `durationMin`, `authorId`, `createdAt`, item | Endpoint agregado por projeto | Nenhuma; usa log manual existente |

## Risks / Trade-offs

- **[Aging incompleto em itens legados]** → mostrar idade mínima conhecida e cobertura, nunca data inventada.
- **[Horas não representam data real do trabalho]** → rotular como horas registradas e usar data do log; timesheet fica para mudança futura.
- **[Eventos podem afetar mutações existentes]** → schema aditivo, serviço transacional pequeno e testes de regressão por caminho de entrada.
- **[Filtros históricos reclassificarem o passado]** → usar snapshots de módulo/sprint/versão/tipo nos eventos e limitar filtros históricos suportados.
- **[Dupla contagem hierárquica]** → determinar folhas no conjunto completo antes de filtrar e testar reparenting/subtasks.
- **[Duplicatas em item_sprints]** → deduplicar em migração, adicionar unicidade e agregar por conjuntos/EXISTS.
- **[Janela entre baseline e instrumentação]** → corte sem writers antigos e baseline criado antes de aceitar tráfego.
- **[Exclusão de projeto bloqueada por analytics]** → cascade/limpeza no limite do projeto, preservando eventos somente enquanto o projeto existir.
- **[Métrica individual ser mal utilizada]** → equipe é apresentada por distribuição e detalhamento, sem score, ranking ou comparação de produtividade.

## Migration Plan

1. Criar cobertura, eventos, ciclos/itens de sprint e índices com isolamento por tenant/projeto; deduplicar `item_sprints` antes da constraint única.
2. Sem aceitar tráfego concorrente, registrar baseline analítico corrente e ciclo parcial para sprint aberta existente.
3. Instrumentar eventos mínimos em transações sem modificar contratos públicos existentes.
4. Liberar API, UI, i18n e documentação do Dashboard.
5. Manter tabelas em rollback; fora a deduplicação auditada de associações idênticas, nenhum dado de domínio existente é removido ou transformado.

## Open Questions

Nenhuma questão bloqueante. Data diária usa UTC nesta fase para evitar novo campo de fuso; `dueDate` permanece uma data civil sem hora.
