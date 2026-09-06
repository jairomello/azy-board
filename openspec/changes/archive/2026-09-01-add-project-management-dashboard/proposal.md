## Why

O Azy Board precisa de uma visão gerencial por projeto que consolide escopo, fluxo atual, prazo, sprints, versões, equipe e horas sem transformar o Dashboard em um segundo sistema de planejamento. A primeira proposta ficou ampla demais; esta revisão mantém aproximadamente 60% dos boxes avaliados e prioriza os mais comuns, úteis e seguros para o modelo atual.

## What Changes

- Adicionar o item **Dashboard** ao menu do projeto e uma página responsiva com dez boxes: Progresso e Escopo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Sprint, Versões, Carga da Equipe e Horas Registradas.
- Calcular imediatamente, com dados existentes, progresso/pontos, WIP, bloqueios, atrasos, progresso de versões, carga atual por responsável/squad e horas informadas em logs manuais.
- Persistir histórico mínimo de estado e escopo para o burnup e o aging WIP sem interpretar `updatedAt` ou textos de atividade.
- Registrar ciclos/baselines ao abrir, suspender ou fechar sprint e marcar sprints legadas como cobertura parcial, sem inventar compromisso histórico.
- Disponibilizar filtros próprios por período, módulo, sprint, versão, squad, responsável e tipo, informando quais filtros se aplicam a cada box.
- Exibir somente números, regras e listas objetivas; não gerar “ações prioritárias”, diagnóstico qualitativo ou recomendação por IA.
- Não adicionar campos obrigatórios nem novos formulários nesta etapa. Horas continuam sendo informadas pelo log manual existente.
- Não incluir finanças, capacidade configurável, burndown, churn isolado, CFD, throughput, lead/cycle time, qualidade de bugs separada, PERT/CPM, Monte Carlo ou Earned Value.

## Capabilities

### New Capabilities

- `project-dashboard`: rota, filtros, dez boxes priorizados, API agregada, detalhamento objetivo, acessibilidade e responsividade.
- `workflow-analytics-history`: eventos mínimos, cobertura e definições históricas necessárias somente para burnup e aging WIP.

### Modified Capabilities

- `sprint-management`: registrar ciclos de abertura/suspensão/fechamento e baseline de compromisso sem alterar os formulários existentes.

## Impact

- Nova rota frontend `/projects/:projectId/dashboard` e item no `AppShell`.
- Novos endpoints somente leitura para snapshot e histórico do Dashboard, disponíveis a usuários com leitura do projeto.
- Migrações aditivas para cobertura por projeto, eventos analíticos e ciclos/itens de baseline de sprint; nenhuma coluna existente será removida ou tornada obrigatória.
- Deduplicação segura de associações `item_sprints` antes de adicionar unicidade, evitando multiplicação de itens/pontos nas agregações.
- Instrumentação transacional das mutações de item e sprint, com cobertura iniciada no deploy e sem backfill fictício.
- Agregação de horas sobre `item_logs.durationMin`, sem migração para um novo módulo de timesheet nesta etapa.
- Tipos compartilhados, testes de regressão/integração/UI, i18n e documentação funcional.
