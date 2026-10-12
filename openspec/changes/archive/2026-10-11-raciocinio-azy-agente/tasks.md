# Tasks

## 1. Accordion de atividade no drawer

- [x] 1.1 Substituir o bloco inline de `run.tools` lado a lado em `apps/web/src/components/AzyAgentDrawer.tsx` por um accordion recolhido por padrão, reutilizando `AccordionSection` (com variação leve se necessário), com estado aberto por `runId`; verificar com teste de componente que o accordion inicia recolhido e expande por teclado/clique
- [x] 1.2 Renderizar as etapas de `run.tools` empilhadas verticalmente dentro do conteúdo do accordion, mantendo `displayName ?? toolName` e o status; verificar com teste de componente que as etapas aparecem uma abaixo da outra
- [x] 1.3 Manter o accordion renderizado após estados terminais (cabeçalho estático) e ocultá-lo apenas quando não houver modelo nem etapas; verificar com teste de componente que o accordion persiste após `COMPLETED`
- [x] 1.4 Atualizar o guarda estrutural `apps/web/src/assistant-ui-contract.test.ts` para o novo bloco, preservando o marcador `[CONTRATO-ESTRUTURAL]` e as asserções de `displayName`; verificar com `bun test apps/web/src/assistant-ui-contract.test.ts`

## 2. Indicador de processamento e nome do modelo

- [x] 2.1 Adicionar `model?: string | null` à interface local `Run` e exibir o nome do modelo como primeiro item do accordion; verificar com teste de componente que o modelo aparece antes das etapas
- [x] 2.2 Derivar a animação do cabeçalho do `run.status` (animar só em execução; parar em concluído/falho/cancelado/expirado/aguardando); verificar com teste de componente que o `Loader2` animado some em estado terminal
- [x] 2.3 Garantir que nenhum credencial, token ou detalhe de provider além do nome do modelo seja exibido; verificar por inspeção/teste que o conteúdo do accordion contém apenas modelo e etapas
- [x] 2.4 Validar que a política de disponibilidade documentada em `openspec/specs/assistant-availability/spec.md` reflete a exibição do modelo ao dono da conversa após o archive; verificar que o delta `specs/assistant-availability/spec.md` cobre o cenário e passa em `openspec validate --strict`

## 3. i18n

- [x] 3.1 Adicionar as chaves do accordion e do estado de processamento (ex.: título do cabeçalho, processando, concluído, modelo) em `apps/web/src/i18n/locales/{pt-BR,en,es}/assistant.json`, sem texto fixo no JSX; verificar com `bun run check:i18n`

## 4. Verificação de integração

- [x] 4.1 Rodar `bun run check` (typecheck + lint + testes + build) e corrigir regressões, incluindo os gates de frontend
- [x] 4.2 Rodar `bun run check:frontend-tests` confirmando que os testes que leem o fonte carregam `[CONTRATO-ESTRUTURAL]`
- [ ] 4.3 Rodar `bun run test:smoke` e a jornada determinística do agente (`e2e`) para confirmar o fluxo de resposta
- [x] 4.4 Rodar `openspec validate raciocinio-azy-agente --strict` e ajustar o que for apontado

## Workflow follow-up

- Registrar `Board ref: 5ae4251b-6a73-43cb-9175-add73c9d7296` nos artefatos e, ao concluir a implementação, fechar o card T55 com `complete_task`, confirmando no board que o status é `DONE`.
- Arquivar a change após a implementação e a revisão do projeto.
