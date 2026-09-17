## Context

As modais de item são compostas por um diálogo `flex` em coluna com `max-h-[95vh]`, cabeçalho e rodapé `shrink-0`, navegação de áreas `shrink-0` e um miolo `min-h-0 flex-1 overflow-y-auto`. Esse arranjo permite rolagem interna, mas o `max-h` faz a altura ser a do conteúdo até o limite de 95vh. Como cada aba tem volumes diferentes, a modal redimensiona a cada troca de área.

O mesmo padrão aparece em dois lugares:

- `ItemModal` (Task/Bug/Subtask): `section` inline com `max-h-[95vh]`.
- `ItemDetailModalShell` (Épico/História): mesma composição, usada por `EpicModal` e `StoryModal`.

Outras modais do produto (`VersionDetailModal`, editor rich text expandido, confirmações, settings) têm ciclos e finalidades diferentes e não fazem parte deste ajuste.

## Goals / Non-Goals

**Goals:**

- Abrir as modais de item com altura fixa de 80% da viewport e mantê-la estável durante toda a interação.
- Fazer o conteúdo — e somente ele — rolar verticalmente dentro dessa altura.
- Manter cabeçalho, navegação de áreas e ações (Salvar/Cancelar) sempre visíveis.
- Aplicar o mesmo contrato a Task, Bug, Subtask, Épico e História, inclusive modais filhas empilhadas.
- Não alterar campos, payloads, regras, i18n ou acessibilidade existentes.

**Non-Goals:**

- Alterar a largura máxima (`max-w-[1120px]`) ou o comportamento responsivo de colunas.
- Alterar modais que não sejam de item (versão, editor rich text expandido, confirmações, settings, dashboard).
- Persistir posição de rolagem ou aba ativa; o estado continua local e efêmero.
- Unificar `ItemModal` com `ItemDetailModalShell` neste change; a duplicação de composição permanece e uma consolidação futura fica para outro change.

## Decisions

### 1. Altura fixa com `height`, não `max-height`

Trocar `max-h-[95vh]` por uma altura fixa de 80% da viewport. Com `height` fixo, o diálogo ocupa o mesmo espaço independentemente do conteúdo e o miolo `flex-1 overflow-y-auto` absorve a diferença, rolando quando necessário.

Alternativa descartada: manter `max-h` e adicionar `min-h`. Isso estabilizaria parcialmente, mas o conteúdo ainda poderia crescer até 95vh e voltar a mudar de tamanho entre abas, reproduzindo o incômodo.

### 2. Unidade de viewport dinâmica com fallback

Usar `80dvh` para acompanhar a viewport dinâmica em mobile (barras de navegador/teclado), com fallback para `80vh`. Para garantir ordem determinística das declarações CSS, criar uma classe utilitária única em `apps/web/src/styles/globals.css` (ex.: `.item-modal-frame { height: 80vh; height: 80dvh; }`) e reutilizá-la nos dois pontos, em vez de duplicar valores arbitrários do Tailwind.

Alternativa descartada: `h-[80dvh]` inline. Funciona, mas não oferece fallback determinístico e espalha o mesmo valor em dois arquivos.

### 3. Aplicar nos dois pontos de composição

A classe será aplicada ao `section` do `ItemModal` e ao `section` do `ItemDetailModalShell`. Como as modais filhas de `ItemModal` renderizam o próprio `ItemModal`, elas herdam automaticamente a altura fixa, assim como Épico/História que usam o mesmo shell.

Alternativa descartada: migrar `ItemModal` para o `ItemDetailModalShell` neste change. Reduziria duplicação, mas envolveria o header com breadcrumb, o botão voltar e o `_onCloseAll` da pilha de modais, aumentando o risco para uma correção essencialmente visual.

### 4. Conteúdo rola, mas o cabeçalho e o rodapé não

O miolo permanece `min-h-0 flex-1 overflow-y-auto`; cabeçalho, abas e rodapé continuam `shrink-0`. A área de atividade mantém seu `min-h-[360px]`, que passa a produzir rolagem interna em vez de expandir a modal.

Alternativa descartada: dar rolagem independente ao painel lateral de propriedades. Isso criaria duas barras de rolagem concorrentes e confundiria a leitura; a rolagem única do conteúdo é suficiente.

### 5. Sem mudança de acessibilidade ou comportamento

`role="dialog"`, `aria-modal`, `aria-labelledby`, `role="tab"`/`aria-selected`/`aria-controls`, foco visível, Escape e o stack de modais permanecem como estão. A altura fixa não altera nenhum contrato funcional.

## Risks / Trade-offs

- **[Viewports muito baixas, como celular em paisagem]** → 80% da altura pode deixar a área de conteúdo pequena; mitigar com `dvh` e scroll interno, garantindo que cabeçalho e ações continuem visíveis.
- **[Teclado virtual em mobile]** → usar `dvh` faz a caixa encolher junto com a viewport; o campo focado permanece acessível pelo scroll do conteúdo.
- **[Espaço vazio em conteúdos curtos]** → é o comportamento desejado pelo usuário; a estabilidade vale mais que o ajuste fino ao conteúdo.
- **[Divergência entre `ItemModal` e o shell]** → a classe utilitária é única e referenciada nos dois pontos; um teste de contrato verifica que ambos a usam.
- **[Regressão na pilha de modais filhas]** → a altura é do próprio componente reaproveitado; validar abertura/fechamento de subtasks após o ajuste.

## Migration Plan

1. Adicionar a classe de altura fixa em `globals.css`.
2. Aplicar a classe no `section` de `ItemModal` e de `ItemDetailModalShell`.
3. Ajustar, se necessário, alturas internas que conflitem com a caixa fixa.
4. Atualizar/expandir testes de contrato para exigir a altura fixa nos dois componentes.
5. Executar `bun run check` e `bun run test:smoke`.
6. Rollback: remover a classe dos dois componentes; não há migração de dados nem API.

## Open Questions

- Vale consolidar `ItemModal` no `ItemDetailModalShell` num change futuro para eliminar a duplicação de composição? Fora do escopo desta correção.
- O editor rich text expandido e a modal de versão devem adotar a mesma regra de altura? Não foram reportados; ficam fora por ora.
