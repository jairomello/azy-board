# Design

## Context

Ver `proposal.md` — Why. O estado atual que orienta as decisões:

- `apps/web/src/styles/globals.css` tem um bloco `:root` claro e dez blocos `:root[data-light-shell-theme="<preset>"]` que trocam apenas tokens do shell e `--board-card-glow-*`. Um único `:root.dark` fixo define a paleta escura azulada e, por vir depois no arquivo com a mesma especificidade (`0,2,0`), vence os blocos de preset.
- `lightShellTheme` é o único valor persistido (`localStorage['light-shell-theme']` + campo `light_shell_theme`), espelhado em `data-light-shell-theme` no `<html>` por `main.tsx` (antes do primeiro render) e por `AuthContext.applyPreferences`.
- O Board já consome tokens `--board-*` em `globals.css` (`.board-canvas`, `.board-column`, `.kanban-card`, `.board-context-header`), então a maior parte do acabamento é alcançável por token, sem tocar nos componentes React.
- O protótipo `docs/prototipos/temas-escuros/` demonstra a direção com CSS adicional sob `:root.dark` e `:root.dark[data-proposta="ameixa"]`, incluindo degradês, reflexos, brilho de contorno e o comportamento de hover/foco.
- Testes existentes: `apps/web/src/shell-theme-parity.test.ts` (lista canônica × amostras × i18n) e `apps/web/src/lib/theme.test.ts` (tema automático).

## Goals / Non-Goals

**Goals:**

- Fazer o preset escolhido definir as variantes clara e escura, com os dez presets existentes.
- Concentrar a mudança em tokens CSS e regras `.dark` no `globals.css`, preservando o visual claro atual.
- Manter um único valor persistido (`lightShellTheme`), sem migração de banco nem de API.
- Deixar o seletor de Aparência honesto quanto aos dois modos.

**Non-Goals:**

- Redesenhar Dashboard, modais, árvore, formulários ou páginas administrativas; eles herdam os tokens globais, mas não recebem tratamento dedicado de superfície.
- Criar presets novos, renomear ids ou permitir combinar preset claro com preset escuro diferente.
- Alterar o contrato do tema automático por horário.
- Copiar o CSS compilado do protótipo inteiro para a aplicação.

## Decisions

### D1 — O atributo existente governa os dois modos

Os blocos escuros usam `:root.dark[data-light-shell-theme="<preset>"]`, sem novo atributo nem campo de preferência. A alternativa (atributo `data-dark-shell-theme` + novo campo `darkShellTheme`) foi descartada porque o usuário escolheu um preset único para os dois modos; um segundo campo criaria estado inconsistente e migração sem ganho.

O bloco `:root.dark` atual permanece como fallback e recebe os valores da variante `petroleum`, garantindo que ausência ou valor inválido de atributo continue renderizando um modo escuro completo.

### D2 — Cascata: blocos escuros por preset substituem o bloco fixo

Estrutura no `globals.css`, nesta ordem:

1. `:root.dark` — fallback (= variante `petroleum`).
2. `:root.dark[data-light-shell-theme="<preset>"]` para os dez presets.

A especificidade `0,3,0` dos blocos por preset vence `:root[data-light-shell-theme]` (`0,2,0`) e `:root.dark` (`0,2,0`), então nenhum token claro vaza para o modo escuro independentemente da ordem. Os blocos claros ficam intocados.

### D3 — Receita parametrizada por matiz, com dois âncoras exatos

Cada variante escura deriva da matiz do acento do preset, com uma escada de luminosidade comum. Saturação baixa nas superfícies grandes evita o efeito "colorido demais"; o acento aparece no shell, nos controles e nos brilhos.

| Preset | Matiz (h) | Saturação-base | Acento | Origem |
| --- | --- | --- | --- | --- |
| `petroleum` | 187 | 14% | `#50e3c2` | acento do preset |
| `ocean` | 207 | 16% | `#67c7ff` | acento do preset |
| `emerald` | 162 | 14% | `#69e0b5` | acento do preset |
| `graphite` | 240 | 5% | `#dadad6` | protótipo **Grafite** (neutro) |
| `classic` | 244 | 10% | `#635bff` | acento do preset |
| `ruby` | 352 | 16% | `#ff6b81` | acento do preset |
| `amber` | 30 | 15% | `#ffb15c` | acento do preset |
| `amethyst` | 272 | 17% | `#b592ff` | protótipo **Ameixa** |
| `rose` | 334 | 16% | `#ff8fc0` | acento do preset |
| `silver` | 215 | 8% | `#b9c4d1` | acento do preset |

Escada de luminosidade (valores de referência; o implementador deriva os hex equivalentes e valida contraste):

- `--background`/`--canvas`: `h S 8%` · `--surface-floating`: `h S 11%` · `--surface`: `h S 13%` · `--surface-raised`: `h S 15%` · `--card`: `h (S-2) 14%`
- `--foreground`/`--card-foreground`: `h 20% 95-96%` · `--muted-foreground`: `h 10% 70%`
- `--primary`: matiz do acento a `74-79%` · `--primary-foreground`: `h 30% 14%` · `--ring`: igual a `--primary`
- `--border`: `h S 27%` · `--input`: `h S 30%` · `--accent`: `h (S+4) 24%`
- `--board-canvas`: 2-3 pontos de L abaixo de `--surface`, dessaturado · `--board-column`: `--surface` +1-2 L · `--board-card`: +6 L sobre a coluna
- `--board-border`/`--board-line`: entre a coluna e a borda global · `--shell-sidebar`: `--background` +1 L · `--shell-header`: `--surface`

Âncoras exatas a preservar (copiadas do protótipo):

- **Grafite**: `background 240 10% 7%`, `card 240 7% 13%`, `board-canvas #101114`, `board-column #1c1e23`, `board-card #25272c`, `board-border #393b40`, `board-glow-a #a5a7ab`, `board-glow-b #d1d0cb`, `shell-sidebar #15161a`, `shell-header #1a1b20`, `shell-accent #dadad6`.
- **Ameixa**: `background 260 21% 8%`, `card 275 17% 14%`, `board-canvas #121019`, `board-column #251f2e`, `board-card #302839`, `board-border #4a3e53`, `board-glow-a #b28bda`, `board-glow-b #c6a0f5`, `shell-sidebar #19151f`, `shell-header #211b29`, `shell-accent #c6a0f5`.

`graphite` é a exceção de acento: mantém o neutro do protótipo em vez do violeta do shell claro, porque é o preset neutro e o protótipo aprovado é a referência. `classic` cobre o papel de "escuro neutro com acento colorido" (índigo).

### D4 — Efeitos como camada `.dark` sobre tokens, não hex fixos

As regras do protótipo (canvas com halo radial, colunas/cabeçalhos com degradê, cards com gradiente e contorno luminoso) entram no `globals.css` como `.dark ...`, usando `color-mix` sobre `--board-*`. Assim os efeitos seguem qualquer variante sem duplicação, e o modo claro não muda. As regras existentes de `.kanban-card` e `.board-*` continuam valendo no claro e são sobrescritas apenas sob `.dark` (dentro de `@layer components`, para não brigar com as utilidades de status).

O `::before` de reflexo do card, hoje branco a 32%, passa a usar `--board-card-glow-b` no escuro, como no protótipo.

Desvio aceito em relação ao protótipo: o protótipo pinta as quatro bordas do card de uma vez, mas a borda esquerda é a faixa de status (`border-l-*`). Para não apagar a cor semântica do status no modo escuro, o contorno luminoso do preset é aplicado só em topo, direita e base.

### D5 — Cores semânticas separadas da decoração

`--status-*` e `--dashboard-series-*` não recebem matiz do preset: continuam azul/violeta/verde/vermelho em todas as variantes, com luminosidade ajustada uma única vez no bloco escuro base. Só os gradientes de progresso do Board usam `--board-glow-a/b`, como no protótipo. Alternativa (tingir status por preset) foi descartada por quebrar o significado das cores.

### D6 — Seletor de Aparência com amostra dividida

Cada tile da grade passa a mostrar a amostra clara e a escura lado a lado (metade superior com sidebar/header claros, metade inferior com os escuros). Isso comunica os dois modos sem precisar observar o tema efetivo no React nem criar contexto novo — a alternativa (amostra que segue o modo ativo) exigiria sincronizar estado de tema efetivo com o DOM, incluindo o modo automático por horário.

`SHELL_THEMES` ganha os campos de amostra escura (`darkSidebar`, `darkHeader`, `darkAccent`) e o teste de paridade passa a exigir que cada preset tenha os dois conjuntos. O rótulo muda de "Tema do shell claro" para "Tema do shell" (e equivalentes em EN/ES); o id do campo e as chaves de persistência **não** mudam.

## Risks / Trade-offs

- **[Dez paletas sem protótipo dedicado podem sair desarmônicas]** → Derivar todas da mesma escada de luminosidade, ancorar `graphite`/`amethyst` nos protótipos e validar visualmente cada variante no Board (claro e escuro, hover, foco, arraste).
- **[Contraste de texto sobre superfícies tonificadas]** → `--foreground` fixado em L 95-96% e `--muted-foreground` em L 70%; conferir WCAG AA nos textos pequenos e nos controles do shell.
- **[Brilho excessivo em telas grandes]** → Limitar opacidades do contorno e do efeito de hover às do protótipo; conferir densidade confortável/compacta.
- **[Custo de manutenção de 10 blocos × ~30 tokens]** → Agrupar os blocos por preset no CSS e cobrir a paridade com teste que lê o `globals.css`, evitando preset sem variante escura.
- **[Impacto no bundle de CSS]** → Crescimento modesto (tokens, não utilitários novos); verificar o orçamento de bundle existente.
- **[Expectativa de "modo escuro em todo o app"]** → Fora de escopo por decisão explícita; demais telas herdam os tokens globais e não recebem tratamento dedicado nesta change.

## Migration Plan

1. Introduzir os blocos escuros por preset e os efeitos no `globals.css`; nenhum dado ou schema muda.
2. Atualizar amostras do seletor e rótulos i18n; a preferência existente passa a valer nos dois modos automaticamente.
3. Rollback: reverter o CSS e os rótulos — os valores persistidos continuam compatíveis (mesmo `lightShellTheme`), sem estado órfão.

## Open Questions

Nenhuma pendência que altere specs, abordagem ou tarefas.
