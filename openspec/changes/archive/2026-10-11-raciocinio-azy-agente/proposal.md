## Why

Hoje o chat do Azy Agent (`apps/web/src/components/AzyAgentDrawer.tsx`) mostra as ferramentas chamadas como selos lado a lado, na mesma linha do loader (`flex items-center gap-2`). O card T55 quer um formato de chatbot mais usual: a atividade do run fica escondida em um accordion abaixo da pergunta do usuário, com um rótulo "Processando …" e animação de carregamento enquanto o run está ativo; a animação para ao terminar; o nome do modelo em uso é a primeira coisa mostrada; e as etapas aparecem em lista vertical, não lado a lado.

O conteúdo do accordion são **etapas de execução** (ferramentas chamadas, modelo, status/erros) — não o raciocínio privado do modelo, que a spec `azy-agent-harness` proíbe expor. O `run.model` já é retornado por `GET /assistant/runs/:runId` para o dono do run; a UI apenas não o consome hoje.

## What Changes

- **Accordion de atividade abaixo da pergunta**: as etapas do run passam a ser renderizadas em um accordion (cabeçalho "Processando …" enquanto ativo, estático ao concluir), recolhido por padrão, em vez de selos lado a lado.
- **Loader animado com estado**: o indicador anima enquanto o run está em andamento e para quando o run atinge estado terminal (concluído, falho, cancelado, expirado ou aguardando usuário/aprovação).
- **Nome do modelo primeiro**: o primeiro item do accordion é o nome do modelo em uso no run.
- **Lista vertical**: as etapas (ferramentas/status) são exibidas uma abaixo da outra, preservando os rótulos amigáveis já fornecidos pelo servidor.
- **Visibilidade do modelo**: o nome do modelo em uso passa a ser exibido a qualquer usuário com acesso ao chat (dono do run), explicitando a política antes restrita a ROOT na spec `assistant-availability`; credenciais e detalhes sensíveis continuam ocultos.
- **i18n**: rótulos do accordion e do estado de processamento nos três idiomas (pt-BR, en, es) no namespace `assistant`.

## Capabilities

### New Capabilities
<!-- Nenhuma: a mudança reformula a apresentação do chat existente e a política de disponibilidade. -->

### Modified Capabilities
- `azy-agent-chat`: define como a interface apresenta as etapas de execução do run (accordion, loader com estado, modelo primeiro, lista vertical).
- `assistant-availability`: explicita que o nome do modelo em uso é exibido ao dono da conversa, sem expor credenciais nem outros detalhes sensíveis.

## Impact

- **Web:** `apps/web/src/components/AzyAgentDrawer.tsx` (bloco de renderização de `run.tools`, interface local `Run` para incluir `model`, estado do accordion), reutilizando `apps/web/src/components/AccordionSection.tsx`, e `apps/web/src/i18n/locales/*/assistant.json`.
- **Contratos/tipos:** a interface local `Run` do drawer passa a refletir o `model` já enviado pelo servidor; `@azy-board/assistant-contracts` já contém `AssistantRun`/`AssistantToolCall` com os campos necessários.
- **Testes:** `apps/web/src/assistant-ui-contract.test.ts` (guarda estrutural que lê o fonte do drawer) precisa ser atualizado junto com o bloco de renderização, mantendo o marcador `[CONTRATO-ESTRUTURAL]`.
- **Backend:** sem mudança de contrato — `GET /assistant/runs/:runId` já retorna `model` e `tools` com `displayName`; nenhuma migration.
- **Assunções registradas:** accordion recolhido por padrão; animação interrompida em qualquer estado terminal; rótulos de ferramenta permanecem localizados apenas no servidor (PT-BR) nesta entrega; "raciocínio" refere-se à atividade de execução, não ao chain-of-thought privado.
- **Rastreabilidade:** Board ref: 5ae4251b-6a73-43cb-9175-add73c9d7296 (card T55).
- **Fora de escopo:** expor raciocínio privado do modelo, mudar o harness/eventos, localizar rótulos de ferramenta no servidor, alterar o painel Root (`RootAssistantSettings`).
