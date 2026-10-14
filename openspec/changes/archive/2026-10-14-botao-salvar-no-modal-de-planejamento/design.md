# Design

## Context

Ver `proposal.md` para a motivação. Estado atual relevante:

- `ProjectPlanningModal` monta o estado `draft` (nome, datas, estimativas, escopo) a partir de `GET /projects/:id` e persiste por *fire-and-forget*: `onBlur` para datas/estimativas, `onBlur` do nome (com a comparação quebrada) e debounce de 800 ms para o escopo rico.
- `ProjectPlanningFields` é **compartilhado** entre a modal e a seção "Planejamento" da página de Settings (`features/project-settings/components/GeneralSettingsSections.tsx`). Ele concentra a decisão de *quando* persistir: `onBlur` nos inputs e o debounce de escopo, ambos dentro do próprio componente.
- A modal já tem estrutura de `header` e `nav` `shrink-0` e uma área de conteúdo com `overflow-y-auto` dentro de altura fixa (`h-[90vh]`), garantida por teste de contrato.
- `PATCH /projects/:id` já aceita atualização parcial de nome, datas, estimativas e escopo, validando pontos/horas ≥ 0, nome não vazio e duplicidade de nome.

## Goals / Non-Goals

**Goals:**

- Gravação explícita e visível na modal, com rascunho local e rodapé de ações.
- Um único `PATCH` por acionamento de Salvar, com apenas os campos alterados.
- Preservar exatamente o comportamento automático da seção de Settings.

**Non-Goals:**

- Unificar o modelo de gravação das duas telas (Settings continua com autosave).
- Alterar rota, schema, dados ou o editor rico.
- Confirmação ao fechar com alterações pendentes.

## Decisions

**1. Prop de modo no componente compartilhado em vez de duplicar os campos.**
`ProjectPlanningFields` passa a receber um modo de gravação (`'auto' | 'manual'`, padrão `'auto'`), e não um booleano. Em `'auto'`, mantém `onBlur` e debounce como hoje — Settings não muda. Em `'manual'`, nenhum callback de persistência é disparado pelo componente: `onPlanningFieldChange`/`onScopeChange` apenas atualizam o rascunho da modal.
*Alternativas:* (a) duplicar os campos só na modal — descartado por duplicar validação de layout e i18n; (b) fazer a modal montar o HTML do escopo por fora — descartado porque o debounce vive dentro do componente.

**2. Rascunho único + comparação com o projeto carregado.**
A modal guarda o `Draft` (strings, como hoje) e o `PlanningProject` original em estado separado. "Alterado" é derivado da comparação entre rascunho normalizado e original. O `PATCH` é montado apenas com os campos divergentes, reaproveitando o contrato parcial da rota.
*Por quê:* mantém `Cancelar`/fechar como descarte puro (nada a desfazer no servidor) e evita gravações redundantes.

**3. Estado do rodapé derivado, não uma máquina de estados.**
`Salvar` fica desabilitado quando não há alterações válidas, quando o nome está vazio ou durante a gravação. Erro de gravação é exibido no rodapé e o rascunho é preservado para nova tentativa.
*Alternativa:* salvar campo a campo ao trocar de aba — descartado; contraria o pedido de gravação explícita.

**4. Rodapé limitado à aba de planejamento e a quem pode editar.**
As abas "Todos os links" e "Todos os anexos" são somente leitura e não têm o que gravar; o rodapé aparece apenas na aba de planejamento e apenas para ADMIN, mantendo a paridade com o modo leitura já existente para MEMBER/VIEWER.

**5. Fechar descarta silenciosamente.**
X, ESC e clique no pano de fundo continuam fechando direto. O rodapé é o único ponto de gravação, o que torna o descarte previsível e alinhado ao requisito "fechar a modal sem alterar os dados do projeto".

## Risks / Trade-offs

- **Quebra do fluxo automático na modal para quem já dependia dele** → o rodapé fica fixo e visível, e o botão Salvar só habilita com alterações; testes de contrato da modal são atualizados no mesmo passo.
- **Regressão na seção de Settings por causa da prop nova** → o novo parâmetro é opcional com padrão `'auto'`; o teste existente da seção de planejamento permanece verde sem alteração.
- **Perda de rascunho ao fechar sem salvar** → aceito por decisão do usuário; o botão Salvar habilita assim que há alteração, tornando a ação de gravar explícita.
- **Escopo rico com HTML grande** → a comparação de rascunho usa a string HTML anterior e a atual; nenhuma normalização além do trim do nome, para não marcar como alteração o que não mudou.
