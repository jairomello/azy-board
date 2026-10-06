# Revisão das melhorias do Azy Board — 2026-10-05

## Objetivo e alcance

Esta revisão atualiza a [análise de 2026-09-11](ANALISE-SISTEMA.md) após a implementação dos cards derivados dela. A pergunta é se as melhorias estão presentes, se as garantias anunciadas funcionam no produto e o que ainda falta para considerar o trabalho concluído. Os cards do Backlog citam este arquivo como especificação de referência.

Foi feita inspeção do código, dos testes, das configurações de CI e deploy e do board real. `bun run check` passou com 1.010 testes aprovados, 12 ignorados e nenhum erro; `check:i18n`, `check:docs`, `check:bundle` e `check:frontend-tests` passaram. O smoke do perfil SIMPLE passou para `/`, `/health/live` e `/api/auth/me` (401 esperado). Não foi executada uma jornada E2E completa nem um teste com serviços PostgreSQL/Valkey nesta revisão. O teste de importação da API configurada como ADVANCED falhou antes de qualquer conexão com PostgreSQL, com `ADVANCED_DATABASE_ADAPTER_NOT_READY`.

## Avaliação geral

Houve melhoria substantiva. Segurança de anexos, hierarquia transacional, `claim` condicional, validação runtime, contrato de erro, constraints, timestamps, limpeza de storage, cache, tratamento de falhas no frontend, identidade global, CI, testes e deploy versionado têm implementação identificável. O perfil SIMPLE dispõe de uma base técnica mais forte que a descrita em setembro.

Ainda não é correto declarar o roteiro inteiro encerrado. O perfil ADVANCED não inicializa a API; a execução do agente permanece acoplada ao processo HTTP; certas garantias de idempotência e publicação de eventos não fazem parte da mesma transação da mutação; e há limites de manutenção, escala e qualidade que pedem prova operacional. Os itens abaixo são trabalho residual, não uma recomendação de reescrever a aplicação.

## P0 — Inicialização e prova do perfil ADVANCED

**Problema.** `apps/api/src/persistence/runtime.ts` escolhe o adapter PostgreSQL para ADVANCED, mas `apps/api/src/index.ts` importa `./db/index` incondicionalmente. Esse módulo recusa ADVANCED para impedir uso acidental do SQLite. O resultado observado foi falha na importação da API com `ADVANCED_DATABASE_ADAPTER_NOT_READY`. Há ainda imports SQLite diretos em serviços como analytics e dashboard. O job `advanced` do CI testa migrations e paridade de adapters, mas não inicializa o servidor nesse perfil.

**Direção técnica.** Fazer o composition root carregar somente serviços e adapters compatíveis com o perfil selecionado. Levar conexões e consultas dependentes de banco para ports/adapters; retirar imports SQLite do caminho de boot e das rotas ADVANCED. Executar migrations PostgreSQL pelo fluxo de deploy e testar aplicação completa com PostgreSQL e Valkey, sem fallback silencioso.

**Critérios de pronto.** API ADVANCED sobe, responde `/health/ready`, autentica e percorre um fluxo real de projeto/item/agente; testes verificam isolamento entre tenants e os contratos principais; o CI inicia o servidor ADVANCED e faz smoke web/API; a documentação informa quais recursos são suportados em cada perfil e como migrar/recuperar a instalação. Qualquer limitação intencional deve aparecer como tal, não como suporte completo.

## P0 — Worker do Azy Agent e propriedade do lease

**Problema.** A fila de runs é persistente e há claim/heartbeat, mas `startServer()` inicia `startAgentWorker()` dentro da API também no ADVANCED. Uma perda de lease em `agentWorker.ts` limpa a referência local da run sem cancelar explicitamente a execução em andamento. Isso deixa em aberto a prevenção de efeitos duplicados quando outro worker reivindica a mesma run. A fila representa progresso real em relação ao código original, porém não prova execução isolada e segura entre processos.

**Direção técnica.** Criar entrada e deploy próprios para worker no ADVANCED, com configuração explícita para a API não consumi-lo nesse perfil. Vincular toda continuação e mutação da run à posse vigente do lease ou a um token de geração (fencing); interromper/impedir chamadas externas e gravações quando a posse se perder. Rever retry, cancelamento, aprovação e recuperação após crash para operações idempotentes.

**Critérios de pronto.** API pode reiniciar sem cancelar runs elegíveis; duas réplicas de worker não executam o mesmo efeito; simulações de lease expirado, crash após chamada de ferramenta, aprovação repetida e cancelamento concorrente têm resultados determinísticos; fila, worker e runs possuem métricas/alertas úteis. No SIMPLE, worker no mesmo processo pode permanecer como decisão explícita.

## P0 — Idempotência, auditoria e eventos na unidade transacional

**Problema.** O fluxo de criação de item grava a mutação em `createItemWithRelations()`, depois faz broadcast e só então salva a resposta idempotente em `saveIdempotent()` (`apps/api/src/routes/items.ts`). O batch segue um padrão semelhante. Se o processo falhar entre commit e gravação da chave, um retry pode repetir a ação. Eventos WebSocket são publicados diretamente pelas rotas e não há outbox geral para republicação durável após crash; a outbox existente é específica da limpeza de storage.

**Direção técnica.** Colocar reserva da chave, resultado/referência da mutação, auditoria, analytics e evento de domínio na mesma transação, com unicidade no banco. Publicar WebSocket a partir de outbox transacional depois do commit, com consumidores idempotentes. Preservar o contrato atual da API e devolver o mesmo resultado para retries legítimos; payload diferente com a mesma chave deve retornar conflito.

**Critérios de pronto.** Testes com falha injetada após cada etapa mostram uma única mutação lógica e uma resposta repetível; duas requisições simultâneas com a mesma chave não geram duplicatas; eventos confirmados chegam ao cliente ou provocam ressincronização; logs/analytics não divergem do estado persistido. Revisar também as demais leituras seguidas de escrita que sustentam limites, posições e transições do agente.

## P1 — Sincronização em várias instâncias

**Problema.** O WebSocket possui sequência, replay em ring buffer e `RESYNC_REQUIRED`, o que atende à reconciliação de uma instância. O buffer e o mapa de conexões são locais ao processo; `index.ts` ainda registra a necessidade de Redis Pub/Sub para broadcast entre instâncias. Um evento emitido na réplica A não chega automaticamente a clientes ligados à réplica B. O fallback após reinício ajuda, mas não substitui transporte distribuído enquanto ambas as réplicas permanecem ativas.

**Direção técnica.** Distribuir eventos confirmados via outbox e barramento/pub-sub, mantendo sequência por projeto e isolamento de tenant. Cada instância deve entregar aos seus clientes ou determinar uma lacuna e exigir refetch. Definir semântica de ordenação, retenção e deduplicação.

**Critérios de pronto.** Teste com duas instâncias da API e clientes em instâncias diferentes confirma entrega e reconciliação após perda de conexão, reinício e lag; nenhuma réplica mostra `Sincronizado` antes de recuperar o estado; não há evento de outro tenant/projeto.

## P1 — Limites entre API, MCP e casos de uso

**Problema.** `packages/tool-registry` centralizou definições e validação, mas `apps/api/src/services/assistantTools.ts` ainda importa `executeSharedTool` de `apps/mcp/src/registry.ts`. Rotas como `items.ts`, `assistant.ts` e `projects.ts` continuam grandes e orquestram validação, leitura, mutação e broadcast. O acoplamento é menor que antes, porém o app MCP ainda participa do runtime da API e a prova de atomicidade depende de percorrer handlers extensos.

**Direção técnica.** Mover a execução compartilhada das ferramentas para um pacote/camada de aplicação sem dependência de `apps/mcp`; deixar MCP como adaptador de transporte. Extrair primeiro os casos de uso mais críticos (criar/editar/mover item, batch e agente), com ports transacionais e autorização explícita. Fazer essa extração junto às correções de idempotência e ADVANCED, evitando uma divisão apenas estética.

**Critérios de pronto.** Build e execução da API não exigem fontes de `apps/mcp`; handlers encaminham para casos de uso testáveis; não há regra de negócio duplicada entre REST, MCP e agente; testes exercitam resultados e efeitos transacionais em SIMPLE e ADVANCED.

## P1 — Escala e semântica das métricas do Dashboard

**Problema.** Há rollup diário no caminho padrão de burnup e consultas otimizadas. Algumas rotas ainda carregam todas as folhas do projeto e fazem agregações em memória; o burnup filtrado ainda percorre histórico de eventos. A análise original de desempenho está parcialmente atendida, mas não há evidência nesta revisão de metas de latência com projetos e históricos grandes.

**Direção técnica.** Definir volumes-alvo, orçamento de latência e limites de resposta por endpoint. Medir com dados representativos; mover agregações que excedam o orçamento para SQL/projeções incrementais, com paginação de listas detalhadas. Preservar as semânticas de cobertura parcial e filtros.

**Critérios de pronto.** Benchmarks reproduzíveis em SIMPLE e ADVANCED; p95 e uso de memória dentro de metas documentadas; resultados equivalentes para filtros, histórico e estados vazios; testes evitam retorno de consultas N+1 ou replay integral sem limite em caminhos comuns.

## P2 — Manutenção do frontend, i18n e testes de interação

**Problema.** O antigo `SettingsPage` foi dividido e o Board ganhou hooks/modelos, porém `BoardScreen.tsx` ainda concentra cerca de 1.220 linhas. Há testes de interação e E2E, mas 28 testes de frontend ainda se declaram contratos estruturais. `check:i18n` garante paridade das chaves e detecta alguns literais acentuados, sem cobrir todo texto fixo ou chaves usadas dinamicamente.

**Direção técnica.** Separar fluxos coesos do Board (filtros, drag, edição, contexto do agente) sem alterar comportamento aprovado. Substituir testes de texto-fonte que descrevam comportamento por testes de componente e jornada. Ampliar a validação de i18n para impedir literais de UI e chaves inválidas, com exceções explícitas.

**Critérios de pronto.** Principais jornadas de login, Board, edição, permissões, Settings e agente rodam em navegador no CI; conflitos, rollback e reconexão são exercitados; scanner detecta textos fixos sem acento e chaves ausentes; a divisão do Board reduz responsabilidades do componente principal e mantém bundle e acessibilidade dentro dos limites.

## P2 — Gates de release e documentação confiável

**Problema.** O workflow de CI é amplo, mas o repositório sozinho não demonstra que seus jobs bloqueiam merge nas regras do GitHub. O smoke atual verifica três URLs e não um fluxo de negócio. A documentação gerada e o `check:docs` reduzem drift, porém o checker valida um conjunto limitado de afirmações proibidas. A análise de setembro contém partes deliberadamente históricas e pode ser lida como diagnóstico atual se não houver ligação com esta revisão.

**Direção técnica.** Configurar required checks para `check`, contratos, smoke, E2E e ADVANCED conforme a política de branches. Fazer smoke ou E2E de um fluxo autenticado essencial por perfil. Consolidar em README/DEPLOY as garantias realmente verificadas, limites e procedimento de rollback/restore; ligar análise original, esta revisão e cards de continuidade.

**Critérios de pronto.** Uma mudança que quebre qualquer perfil ou contrato essencial bloqueia merge; execução de restore é testada periodicamente; documentação acompanha releases e não promete garantias não exercitadas; há uma definição de pronto curta e verificável para fechar os cards desta revisão.

## Ordem sugerida e relação com o board

1. Fazer a API ADVANCED iniciar e passar smoke real.
2. Fechar idempotência e propriedade do worker; estes são riscos de duplicação de efeitos.
3. Completar publicação/sincronização distribuída e separar execução compartilhada API/MCP.
4. Medir Dashboard; depois tratar manutenção de UI, cobertura de testes, i18n e gates de release.

Os cards de continuidade ficam no **Backlog** porque esta revisão planeja o trabalho, mas não autoriza começar a implementação. Os IDs são registrados abaixo após a criação no board.

| Prioridade | Card no Azy Board | ID | Tema |
|---|---|---|---|
| P0 | T36 | `932bd490-4503-42b3-9193-5327926fda33` | Inicialização e teste ADVANCED |
| P0 | T37 | `341ba802-bef6-4659-a15d-385749b469c1` | Worker e lease do agente |
| P0 | T38 | `8ee60cea-aa36-4b87-bb0d-e743e5e3e367` | Idempotência e eventos transacionais |
| P1 | T39 | `32b627cf-18d5-4d0e-b7fb-323638e8e7e3` | Tempo real entre instâncias |
| P1 | T40 | `5a92afc0-d02d-4dbe-9852-b931cb81ecb2` | Limites API/MCP e casos de uso |
| P1 | T41 | `503e5a70-32a0-4de0-a78d-cb52f4b9c958` | Escala do Dashboard |
| P2 | T42 | `25667747-2b18-43b6-badc-a2e461527c44` | Board, i18n e testes de interação |
| P2 | T43 | `c7156663-1b21-44ed-9dfb-77a207ac9086` | Gates de release e documentação |

Cada card possui a descrição do problema, uma direção de solução, critério de fechamento e um checklist nativo de quatro etapas. Todos foram cadastrados sem responsável no Backlog.
