# Tasks

## 1. Modo de gravação explícita no componente compartilhado

- [x] 1.1 Adicionar a `ProjectPlanningFields` um parâmetro de modo de gravação com padrão automático, mantendo `onBlur` nos inputs e o debounce de 800 ms do escopo quando o modo for automático; verificar com `bun test apps/web/src/features/project-settings` que a seção de Settings não mudou de comportamento
- [x] 1.2 No modo explícito, fazer os callbacks de campo e de escopo apenas atualizarem o rascunho, sem nenhuma chamada de persistência a partir do componente; verificar com teste novo `apps/web/src/components/project-planning-fields.test.tsx` que, em modo explícito, `onPlanningChange` não é chamado após `change`+`blur` nem após o intervalo do debounce

## 2. Rascunho local e rodapé de ações na modal

- [x] 2.1 Manter no `ProjectPlanningModal` o projeto carregado em estado separado do rascunho e derivar "alterado" pela comparação entre eles (nome comparado sem espaços nas pontas, demais campos por igualdade); verificar com teste que alterar um campo não dispara nenhuma requisição
- [x] 2.2 Renderizar o rodapé com as ações de salvar e cancelar na aba de planejamento, fora da área rolável do conteúdo e apenas para ADMIN, reaproveitando `common:save`, `common:cancel` e `common:saving`; verificar com teste que o rodapé existe para ADMIN e não existe para MEMBER/VIEWER
- [x] 2.3 Implementar a gravação em um único `PATCH /projects/:id` com apenas os campos divergentes, desabilitando campos e rodapé durante a requisição e habilitando o botão de salvar apenas quando houver alteração válida; verificar com teste que o corpo do `PATCH` contém somente o campo alterado e que o botão fica indisponível sem alterações
- [x] 2.4 Exibir a falha de gravação no rodapé preservando o rascunho para nova tentativa, reaproveitando `board:projectPlanningSaveError`; verificar com teste que o valor digitado permanece na tela e que o botão volta a ficar disponível após o erro
- [x] 2.5 Persistir o nome do projeto pelo botão de salvar e bloquear a gravação quando o nome estiver vazio, indicando obrigatoriedade; verificar com teste que o nome alterado aparece no `PATCH` e que nome vazio não gera requisição
- [x] 2.6 Remover o salvamento automático da modal (gravação por `blur` nas datas/estimativas e no nome, e debounce de escopo), mantendo o cancelar e o fechamento (X, ESC, clique fora) como descarte silencioso do rascunho; verificar com teste que cancelar e fechar não enviam requisição e que reabrir a modal exibe os valores do servidor

## 3. Testes, contrato estrutural e documentação da modal

- [x] 3.1 Atualizar `apps/web/src/components/project-planning-modal.test.tsx` para o fluxo de rodapé (alterar → salvar, cancelar, fechar, erro, permissão de edição) e remover as asserções de `PATCH` por `blur`; verificar com `bun test apps/web/src/components/project-planning-modal.test.tsx`
- [x] 3.2 Preservar o contrato estrutural da altura fixa da modal com o rodapé fora da área rolável; verificar com o teste existente "mantém altura fixa independente da aba ativa" e com `bun run check:frontend-tests`
- [x] 3.3 Confirmar que os rótulos do rodapé vêm das chaves já existentes em `common` nos três idiomas e que nenhum texto fixo novo entrou no código; verificar com `bun run check:i18n`
- [x] 3.4 Documentar o fluxo de gravação explícita na seção "Planejamento do projeto (modal)" de `docs/azyboard-wiki/07 - Configuracoes do Projeto/Configuracoes do Projeto.md`; verificar com `bun run check:docs`

## 4. Verificação de integração

- [x] 4.1 Rodar `bun run check` (typecheck, lint, fronteiras, testes e build) e corrigir o que aparecer
- [x] 4.2 Rodar `bun run test:smoke` e confirmar que abrir a modal, salvar um campo e reabrir exibe o valor persistido

## Workflow follow-up

- Arquivar a change após a revisão do projeto.
- Nenhum card do Azy Board está vinculado a esta change (decidido com o usuário).
