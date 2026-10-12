## Context

Ver `proposal.md` — Why. Estado atual relevante (levantado na inspeção):

- O chat inteiro vive em `apps/web/src/components/AzyAgentDrawer.tsx`. As etapas são renderizadas inline em `flex items-center gap-2` (selos lado a lado) dentro do bloco de `run.tools` (~linhas 508–526), com `Loader2` + `animate-spin`. O bloco só aparece quando o run existe e o status **não** é `WAITING_APPROVAL`/`COMPLETED`/`FAILED`/`CANCELLED`/`EXPIRED`.
- `GET /assistant/runs/:runId` já retorna `model` e `tools[]` com `displayName` para o dono do run (`apps/api/src/routes/assistant.ts:881`); o `run.model` é preenchido no enqueue e depois refinado pelo harness para `PROVIDER/model`.
- A interface local `Run` do drawer **não** inclui `model` hoje.
- Eventos SSE de `TOOL_STARTED`/`TOOL_COMPLETED` apenas disparam refetch de `GET /runs/:runId` (não há lista incremental local).
- Existe um primitivo de accordion acessível: `apps/web/src/components/AccordionSection.tsx` (controlado por `isOpen`/`onToggle`, `aria-expanded`/`aria-controls`, `ChevronDown`).
- `apps/web/src/assistant-ui-contract.test.ts` é um guarda estrutural marcado `[CONTRATO-ESTRUTURAL]` que lê o fonte do drawer e exige, entre outros, `tool.displayName` e a **ausência** de `tool.toolName}:`.
- A spec `azy-agent-harness` proíbe expor raciocínio privado do modelo; a spec `assistant-availability` restringia a exposição de contexto para não-ROOT.
- `prefers-reduced-motion` é respeitado globalmente (`apps/web/src/styles/globals.css:520-527`), então a animação pode não ocorrer para quem opta por não animar.

## Goals / Non-Goals

**Goals:**
- Apresentar a atividade do run em accordion vertical abaixo da pergunta, recolhido por padrão.
- Mostrar o nome do modelo em uso como primeiro item e a lista de etapas empilhada.
- Animar o cabeçalho apenas enquanto o run está ativo; parar em estados terminal/espera.
- Exibir o nome do modelo ao dono do run (todos os usuários com acesso ao chat), sem expor credenciais.
- Reutilizar a acessibilidade existente e manter o guarda estrutural atualizado.

**Non-Goals:**
- Expor o raciocínio privado do modelo ou alterar o harness/eventos.
- Alterar o painel Root (`RootAssistantSettings`) ou a política de disponibilidade do toggle.
- Localizar rótulos de ferramenta no servidor (permanecem PT-BR nesta entrega).
- Persistir o estado aberto/fechado do accordion entre sessões.

## Decisions

### D1. Reutilizar o accordion acessível existente
Usar `AccordionSection` (ou uma variação leve com `className`/`summary`) como cabeçalho+conteúdo do bloco de atividade, em vez de criar um componente novo. Motivo: um único ponto de acessibilidade (`aria-expanded`/`aria-controls`, foco visível). Alternativa rejeitada: novo componente dedicado, que duplicaria a lógica de a11y.

### D2. Estado aberto por run no drawer
O estado aberto/fechado é controlado no `AzyAgentDrawer` (ex.: um `Set<string>`/mapa por `runId`), iniciando recolhido. Motivo: o drawer já concentra o estado do run; evita persistência e mantém o comportamento por aba.

### D3. Fonte de dados: `run.model` + `run.tools`
Adicionar `model?: string | null` à interface local `Run` e renderizar, na ordem: nome do modelo, depois as etapas de `run.tools` (com fallback `displayName ?? toolName`). Motivo: o servidor já entrega tudo; não é preciso consumir eventos incrementalmente. Alternativa considerada: manter lista local a partir dos eventos SSE — mais código e sujeito a divergência do estado autoritativo.

### D4. Animação derivada do status terminal
O indicador animado aparece somente enquanto o `run.status` não é terminal nem de espera; usar o mesmo conjunto de estados já usado no drawer. Motivo: uma única fonte de verdade. Com `prefers-reduced-motion`, a animação é suprimida pelo CSS global e o rótulo textual permanece.

### D5. Persistência do accordion após concluir
O accordion permanece renderizado após estados terminais (ex.: para inspecionar as etapas), com cabeçalho estático, exceto quando não houver etapas. Motivo: atende "pare de animar quando termina" sem sumir com o histórico da atividade.

### D6. Visibilidade do modelo (decisão de política)
Exibir o nome do modelo do run a qualquer dono da conversa. Isso materializa a decisão do usuário e é refletida como MODIFIED em `assistant-availability`. Nenhuma mudança de backend é necessária, pois `GET /runs/:runId` já retorna `model`; a UI nunca exibe credencial/token.

### D7. i18n e guarda estrutural
Novas chaves no namespace `assistant` nos três idiomas (pt-BR, en, es), sem texto fixo no JSX. O guarda `assistant-ui-contract.test.ts` é atualizado junto com o bloco de renderização, preservando o marcador `[CONTRATO-ESTRUTURAL]` e a exigência de usar `displayName`.

## Risks / Trade-offs

- **`run.model` nulo antes da primeira resposta do modelo** → exibir o rótulo de modelo apenas quando presente, sem placeholder enganoso; o enqueue já grava um valor inicial na maioria dos casos.
- **Guardas estruturais quebram ao refatorar** → atualizar `assistant-ui-contract.test.ts` na mesma mudança e manter `displayName`.
- **Divergência com a spec de disponibilidade** → resolvida explicitamente pelo delta de `assistant-availability`.
- **Orçamento de bundle** → reutilizar componentes e ícones `lucide-react` já presentes; evitar dependências novas.
- **Rótulos de ferramenta só em PT-BR no servidor** → fora de escopo; exibir `displayName` como recebido.
- **Acessibilidade da animação** → `prefers-reduced-motion` desativa o giro; o rótulo textual cobre o estado.
