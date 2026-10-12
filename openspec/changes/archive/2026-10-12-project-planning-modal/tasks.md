# Tasks

## 1. Backend — leituras agregadas por projeto

- [x] 1.1 Adicionar `listByProject(context, projectId)` às portas de persistência de links e de anexos, com filtro obrigatório por `tenant_id` e `project_id` (`// [TENANT]`), e implementar nos adapters SQLite e PostgreSQL; validar com testes de persistência que um item de outro projeto/tenant não aparece.
- [x] 1.2 Criar rota `GET /projects/:projectId/links` (`requireRole('VIEWER')`) que retorna todos os links do projeto com o item de origem; validar com teste de integração API cobrindo lista, lista vazia e isolamento entre projetos.
- [x] 1.3 Criar rota `GET /projects/:projectId/attachments` (`requireRole('VIEWER')`) que retorna todos os anexos do projeto com o `itemId` de origem, reaproveitando `serializeAttachment`; validar com teste cobrindo lista, lista vazia, anexos desabilitados e isolamento entre projetos.
- [x] 1.4 Montar as novas rotas no `apps/api/src/index.ts` (`api.route('/projects/:projectId/links', ...)` e `api.route('/projects/:projectId/attachments', ...)`) e confirmar que os endpoints respondem com os contratos esperados.

## 2. Frontend — componente da modal

- [x] 2.1 Extrair os campos de planejamento de `GeneralSettingsSections` para um subcomponente reutilizável e usá-lo na modal, mantendo o comportamento atual de Configurações; validar com teste de contrato existente de settings.
- [x] 2.2 Criar `ProjectPlanningModal.tsx` com cabeçalho, campos de planejamento e navegação por abas (`role="dialog"`/`role="tab"`), carregando via `GET /projects/:id` e salvando via `PATCH /projects/:id`; validar com teste de componente cobrindo edição (ADMIN) e modo leitura (MEMBER/VIEWER).
- [x] 2.3 Implementar a aba "Todos os links" (somente leitura, com origem e abertura em nova guia) consumindo `GET /projects/:id/links`; validar com teste cobrindo lista, estado vazio e ausência de controles de edição.
- [x] 2.4 Implementar a aba "Todos os anexos" (somente leitura, com origem, metadados e download pela rota do item), ocultando a aba quando `GET /tenant/attachments/enabled` retorna `enabled=false`; validar com teste cobrindo lista, estado vazio, download e tenant desabilitado.

## 3. Pontos de entrada

- [x] 3.1 Adicionar prop opcional `onProjectNameActivate` ao `AppShell` e tornar o nome do projeto um controle acessível quando fornecida, sem alterar o comportamento atual quando ausente; validar com teste de contrato do `AppShell`.
- [x] 3.2 Integrar a modal ao `BoardScreen`, fornecendo `onProjectNameActivate` e renderizando a modal com o projeto atual; validar com teste cobrindo a abertura pela ativação do nome.
- [x] 3.3 Substituir o modal de edição de nome em `ProjectsPage` pela `ProjectPlanningModal`, abrindo-a pelo botão de editar de cada projeto; validar com teste cobrindo a abertura com o projeto correto.

## 4. i18n e documentação

- [x] 4.1 Adicionar as chaves de tradução da modal (abas, estados vazios, labels de planejamento) em PT-BR, EN e ES; validar com `bun run check:i18n`.
- [x] 4.2 Atualizar a documentação de uso (configuração/planejamento do projeto) descrevendo os dois pontos de entrada e as abas somente leitura; validar com `bun run check:docs`.

## 5. Verificação de integração

- [x] 5.1 Executar `bun run check` (typecheck + lint + testes + build) e corrigir eventuais falhas.
- [x] 5.2 Executar `bun run test:smoke` e confirmar o fluxo web/API com a modal e as leituras agregadas.

## Workflow follow-up

- Encerrar o card T59 (`7a99fc9f-43e9-47a2-99ca-b04499630ab6`) com `complete_task` e confirmar no board que o `status` é `DONE`.
- Arquivar a change após a revisão.
