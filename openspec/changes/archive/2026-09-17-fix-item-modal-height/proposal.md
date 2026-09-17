## Why

As modais de item usam teto variável (`max-h-[95vh]`), então a janela cresce e encolhe conforme o conteúdo de cada aba. Trocar de `Detalhes` para `Subtasks` ou `Histórico` redimensiona a modal repetidamente, desloca o cabeçalho e o rodapé e torna a leitura e a edição instáveis — sensação de "janela pulando". O usuário relatou o problema em épico e história e não o notou em task, mas a task tem exatamente o mesmo comportamento.

## What Changes

- Fixar a altura das modais de item (Task, Bug, Subtask, Épico e História) em **80% da altura disponível na viewport** desde a primeira renderização, sem variar conforme o conteúdo ou a aba ativa.
- Manter cabeçalho, navegação de áreas e rodapé de ações sempre visíveis, com rolagem vertical restrita ao conteúdo.
- Garantir que cada aba role de forma independente dentro da altura fixa, sem rolagem horizontal.
- Garantir que modais filhas empilhadas (subtasks de task, filhos de épico/história) também abram com a altura fixa.
- Preservar campos, payloads, acessibilidade, navegação por áreas e toda a lógica existente; a mudança é exclusivamente de composição e altura.

## Capabilities

### New Capabilities

- `item-modal-layout`: contrato de composição e altura das modais de item, definindo altura fixa de 80% da viewport, cabeçalho/áreas/rodapé persistentes e rolagem exclusiva do conteúdo, independente do tipo do item e do conteúdo da aba.

### Modified Capabilities

Nenhuma. O comportamento existente de layout, áreas e acessibilidade permanece válido; o novo contrato apenas adiciona a regra de altura fixa e o escopo de rolagem, sem alterar requisitos já especificados. A capacidade é separada para não conflitar com a mudança `align-epic-story-forms`, ainda não arquivada, que também toca essas modais.

## Impact

- Frontend: `ItemModal` (Task/Bug/Subtask), `ItemDetailModalShell` (épico/história) e áreas internas que usam `min-h` (ex.: atividade) para acomodar a altura fixa.
- Nenhuma alteração de API, banco, rotas, payloads, i18n ou permissões.
- Acessibilidade: foco, `role="dialog"`, `aria-modal`, foco visível e ordem de tabulação permanecem; o conteúdo passa a rolar dentro de uma caixa de altura estável.
- Responsividade: usar unidade de viewport dinâmica para lidar com barras de navegador em mobile; sem rolagem horizontal.
- Dependências: nenhuma nova.
