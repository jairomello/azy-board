Board ref: 67156036-dd4c-4151-9b11-61c5010954bb

## 1. Infraestrutura de testes de componente

- [x] 1.1 Adicionar em `apps/web` as devDependencies MIT de DOM e Testing Library (`happy-dom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`) e instalar com `bun install`
- [x] 1.2 Criar `apps/web/src/test/setup.ts` registrando o DOM do `happy-dom`, os matchers de acessibilidade e a limpeza entre testes
- [x] 1.3 Documentar a convenção de importar o setup apenas em testes de componente (sem preload global) em um comentário no próprio setup
- [x] 1.4 Adicionar o script `test:web` no `package.json` para execução focada da suíte do web
- [x] 1.5 Escrever um teste de componente piloto que renderiza, consulta por papel acessível e simula interação, comprovando a infraestrutura

## 2. Migração dos testes de texto-fonte

- [x] 2.1 Inventariar os 24 `*-contract.test.ts` de texto-fonte e classificar cada um em migrar, manter com justificativa ou remover
- [x] 2.2 Migrar os contratos de Board/realtime (`board-realtime-contract`, `optimistic-mutations-contract`, `client-cache-contract`) para testes de comportamento sobre os módulos `model/` e hooks
- [x] 2.3 Migrar os contratos de layout/edição de item (`item-modal-layout-contract`, `item-modal-spacing-contract`, `accordion-item-detail-contract`, `rich-text-editor-contract`) para testes de componente
- [x] 2.4 Migrar os contratos de visibilidade/permissões (`project-visibility-contract`, `project-visibility-badges-contract`, `ui-mode-contract`) para testes de comportamento/componente
- [x] 2.5 Migrar os contratos de tela e navegação (`app-shell-layout-contract`, `dashboard-contract`, `assistant-ui-contract`, `assistant-screen-context`, `frontend-page-modularity-contract`, `error-boundary-contract`, `active-filter-chips`, `card-copy-reference-contract`, `checklist-advanced-fields-contract`, `epic-story-forms-contract`, `history-worklog-panel-contract`, `components/user-avatar-contract`, `lib/appUrl-usage-contract`) para o nível comportamental adequado
- [x] 2.6 Manter apenas os contratos estruturais de invariantes não comportamentais, adicionando comentário justificativo em cada arquivo remanescente
- [x] 2.7 Remover cada contrato de texto-fonte somente após o teste substituto estar verde, executando `bun test`
- [x] 2.8 Adicionar verificação leve que sinaliza novos testes que apenas leem o código-fonte sem justificativa (script ou convenção aplicada no CI)

## 3. E2E de navegador ampliado

- [x] 3.1 Modularizar o harness E2E existente (`e2e/regression.ts`) em jornadas reutilizáveis e um runner com resumo, preservando o stack descartável
- [x] 3.2 Ampliar a jornada de Board para criar card, mover entre colunas e reordenar por arrastar, validando persistência após a operação
- [x] 3.3 Ampliar a jornada de Settings para excluir coluna, squad e módulo sem erro exibido
- [x] 3.4 Adicionar jornada de permissões autenticando com papel sem acesso administrativo e validando o bloqueio na interface
- [x] 3.5 Substituir esperas fixas por esperas por estado observável e adicionar retry limitado com timeouts explícitos
- [x] 3.6 Garantir limpeza total do stack e do banco temporário ao final, inclusive em falha

## 4. Jornada determinística do Azy Agent

- [x] 4.1 Introduzir um provider de LLM determinístico de teste, reutilizando o seam `provider` do `AssistantHarness`
- [x] 4.2 Selecionar o provider de teste por variável de ambiente na composição da rota do assistente, bloqueando-o quando `NODE_ENV=production`
- [x] 4.3 Adicionar teste de unidade/API comprovando que o provider de teste não é selecionável em produção
- [x] 4.4 Adicionar jornada E2E do agente que abre o drawer, envia mensagem e valida a resposta determinística sem chamar provider externo

## 5. Regressão visual

- [x] 5.1 Adicionar `pixelmatch` e `pngjs` como devDependencies e implementar o utilitário de comparação de screenshots com tolerância configurável
- [x] 5.2 Definir viewport, tema e dados de seed determinísticos para o conjunto estável de telas (login, projects, board, settings, dashboard)
- [x] 5.3 Capturar e versionar as baselines iniciais em `e2e/__screenshots__/`
- [x] 5.4 Adicionar o comando de regeneração explícita de baselines (`E2E_UPDATE_SNAPSHOTS=1`)
- [x] 5.5 Adicionar o script `test:visual` e publicar imagens de diferença quando houver falha
- [x] 5.6 Executar a regressão visual no ambiente controlado e estabilizar baselines antes de torná-la bloqueante

## 6. Integração à verificação e ao CI

- [x] 6.1 Confirmar que `bun run check` executa os testes de comportamento e de componente do web via `bun test`
- [x] 6.2 Atualizar `test:regression` para incluir a suíte de frontend e, com `--with-e2e`, as jornadas e a regressão visual
- [x] 6.3 Adicionar job de E2E de navegador em `.github/workflows/ci.yml` com Chromium do sistema e publicação de artefatos em falha
- [x] 6.4 Verificar localmente `bun run check`, `bun run test:e2e` e `bun run test:regression --with-e2e`
- [x] 6.5 Verificar `bun run test:smoke` para o fluxo web/API

## 7. Documentação e fechamento

- [x] 7.1 Atualizar `TESTING.md` com os níveis de teste, comandos, pré-requisitos do E2E, regressão visual e a política de contratos estruturais
- [x] 7.2 Registrar no card do board (`Board ref: 67156036-dd4c-4151-9b11-61c5010954bb`) o vínculo com esta change
- [x] 7.3 Ao concluir a implementação, fechar o card com `complete_task` e confirmar no board que o status é `DONE`
