# Tasks

## 1. Tokens escuros por preset

- [x] 1.1 Transformar o bloco `:root.dark` de `apps/web/src/styles/globals.css` na variante escura de `petroleum`, preservando todos os tokens hoje declarados (`--background`, `--card`, `--primary`, `--surface*`, `--board-*`, `--shell-*`, `--status-*`, `--dashboard-series-*`) e o fallback para atributo ausente; verificar que o modo escuro atual continua renderizando com `petroleum` antes de qualquer bloco novo.
- [x] 1.2 Adicionar os blocos `:root.dark[data-light-shell-theme="<preset>"]` para os nove presets restantes (`ocean`, `emerald`, `graphite`, `classic`, `ruby`, `amber`, `amethyst`, `rose`, `silver`) com a receita de matiz e a escada de luminosidade do `design.md`; verificar que cada bloco define os mesmos tokens do fallback (script de comparação de chaves ou revisão assistida) e que nenhum token claro vaza para o escuro.
- [x] 1.3 Fixar as âncoras exatas dos protótipos **Grafite** (`graphite`) e **Ameixa** (`amethyst`) nos blocos correspondentes, incluindo `--board-glow-*` e `--shell-accent`; verificar abrindo o Board escuro com esses dois presets e comparando com `docs/prototipos/temas-escuros/grafite.html` e `ameixa.html`.
- [x] 1.4 Ajustar `--status-*` e `--dashboard-series-*` uma única vez na base escura para contraste sobre as superfícies tonificadas, mantendo os matizes semânticos; verificar contraste AA dos textos de status e dos chips com as ferramentas do navegador em pelo menos `graphite`, `petroleum`, `ruby` e `silver`.
- [x] 1.5 Estender `apps/web/src/shell-theme-parity.test.ts` para ler `globals.css` e exigir um bloco escuro completo por preset da lista canônica, sem preset órfão; verificar com `bun test apps/web/src/shell-theme-parity.test.ts`.

## 2. Acabamento visual do Board no modo escuro

- [x] 2.1 Portar para `globals.css` as regras `.dark .board-canvas`, `.dark .board-column` e `.dark .board-column-header, .dark .board-context-header` do protótipo, usando `color-mix` sobre `--board-*`; verificar que o modo claro permanece idêntico (comparar antes/depois nas mesmas telas) e que o escuro mostra halo, degradê e sombra em todos os presets.
- [x] 2.2 Aplicar o acabamento do card (gradiente, contorno misturado com `--board-card-glow-*`, brilho, sombra e `::before` de reflexo) apenas sob `.dark`, com realce maior em `:hover` e `:focus-within`; verificar visualmente hover e foco por teclado em card arrastável e não arrastável, sem ofuscar texto, código e etiquetas.
- [x] 2.3 Fazer as barras de progresso do Board usarem o gradiente do preset no escuro (contexto e cards, incluindo `bg-status-progress`), sem alterar o claro; verificar no Board e no resumo de contexto que a barra acompanha a troca de preset sem reload.
- [x] 2.4 Conferir que o acabamento não adiciona animação contínua e respeita `prefers-reduced-motion`, e que não conflita com as utilidades de faixa de status nem com o placeholder de arraste; verificar com a preferência de movimento reduzido ativada e durante um arraste de card.

## 3. Seletor de Aparência e traduções

- [x] 3.1 Acrescentar amostras escuras (`darkSidebar`, `darkHeader`, `darkAccent`) a cada entrada de `SHELL_THEMES` em `apps/web/src/lib/shellThemes.ts`, alinhadas aos tokens do `globals.css`; verificar no teste de paridade que toda entrada tem os dois conjuntos.
- [x] 3.2 Atualizar a grade de `apps/web/src/pages/AccountPage.tsx` para exibir a amostra clara e a escura no mesmo tile, mantendo `role="radio"`, `aria-checked`, navegação por setas e anel de foco; verificar com teclado nos dois modos e confirmar que a seleção persiste.
- [x] 3.3 Trocar o rótulo de `lightShellTheme` para "Tema do shell" nos três idiomas (`apps/web/src/i18n/locales/{pt-BR,en,es}/settings.json`) e revisar a dica exibida no modo escuro (`lightThemeDarkHint`), que deixa de fazer sentido; verificar com `bun test apps/web/src/shell-theme-parity.test.ts` e navegando nas três línguas.
- [x] 3.4 Cobrir a amostra dividida e os rótulos com teste de componente ou snapshot na AccountPage; verificar que o teste falha se um preset ficar sem amostra escura.

## 4. Verificação integrada

- [x] 4.1 Percorrer a matriz dos dez presets no modo escuro (Board, shell, hover, foco, arraste, densidade confortável e compacta) e nos dois modos com tema automático por horário; verificar que a troca não recarrega, não pisca e que nenhum preset se confunde com outro.
- [x] 4.2 Comparar o resultado com os dois protótipos HTML e os SVGs de referência e registrar eventuais desvios aceitos (ex.: acento do `graphite`); verificar que os desvios estão justificados no `design.md`.
- [x] 4.3 Rodar `bun run check` e `bun run test:smoke` e corrigir o que falhar; verificar que o orçamento de bundle de CSS continua dentro do limite do projeto.

## Workflow follow-up

- Arquivar a change após revisão visual aprovada, conforme o fluxo do OpenSpec.
- Card vinculado: `T90` (`a7ab0895-f7c6-4682-bee4-4b45c8adff68`), concluído no Azy Board.
