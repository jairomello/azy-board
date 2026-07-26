## Why

O Board atual concentra navegação, preferências, filtros e criação em duas barras visualmente semelhantes. O conteúdo funciona, mas a hierarquia depende quase apenas de bordas, fundos neutros e do `primary` azul padrão. No modo escuro, as superfícies usam variações muito próximas de azul-marinho. O resultado é funcional, porém genérico e com pouca identidade própria.

A direção visual aprovada estabelece uma moldura estrutural forte, com sidebar e header flutuantes, toolbar compacta, contexto da sprint, melhor distinção entre swimlanes, colunas e cards e uma barra discreta de status. Para o modo claro, a combinação aprovada usa petróleo no shell. Como cor é uma preferência subjetiva, o usuário deve poder escolher outros temas estruturais claros sem alterar o modo escuro.

> Estado: implementação funcional consolidada; validações visuais automatizadas e testes específicos de preferências permanecem rastreados em `tasks.md`.

## What Changes

- Introduz um `AppShell` reutilizável com sidebar responsiva, header principal e região de conteúdo
- Refatora o Board conforme os mockups aprovados para modo claro e modo escuro
- Reorganiza Board/Árvore, filtros, densidade e criação em uma toolbar flutuante e compacta
- Consolida Épico, História, Task e Bug em uma ação principal **Criar**, preservando criação contextual nas colunas
- Torna projeto, sprint ativa, progresso, sincronização e contagem de itens visíveis parte do contexto operacional
- Reforça a hierarquia visual de swimlanes, colunas, limites de WIP e cards
- Adota por padrão a hierarquia aninhada **Épico → História → Cards**, com accordions independentes
- Redefine o toggle de histórias para alternar entre lanes e cards e adiciona ocultação de histórias vazias
- Mantém criação contextual dentro da história e separação visual entre cabeçalhos de coluna e cards
- Adiciona a preferência `lightShellTheme`, independente de `theme: light | dark`
- Adiciona presets de shell claro: `petroleum`, `ocean`, `emerald`, `graphite` e `classic`
- Adiciona uma seção **Aparência** em `/account`, com preview e seleção dos presets
- Persiste o preset no banco e no `localStorage`, aplicando-o antes do primeiro render
- Cria ou consolida `PATCH /api/users/me` para salvar tema, preset claro e idioma com isolamento por usuário e tenant

## Capabilities

### New Capabilities

- `board-visual-layout`: shell e hierarquia visual do Board, incluindo layout responsivo e estados operacionais

### Modified Capabilities

- `theming`: passa a suportar presets estruturais dentro do modo claro, persistidos entre dispositivos
- `account-settings`: passa a incluir uma seção de Aparência com seleção de modo e tema estrutural claro

## Impact

- **Frontend:** `BoardPage`, `KanbanCard`, `BoardFilters`, `AccountPage`, `ThemeToggle`, `AuthContext`, inicialização em `main.tsx`, tokens globais e novos componentes de shell
- **API:** nova rota protegida de preferências do usuário ou correção da rota já referenciada pelo frontend
- **Banco:** nova coluna `users.light_shell_theme`, com default `petroleum`
- **Tipos compartilhados:** novo tipo `LightShellTheme`
- **i18n:** labels e descrições dos presets em PT-BR, EN e ES
- **Testes:** preferências, bootstrap sem flash, responsividade, acessibilidade e regressões funcionais do Board
- **Dependências:** nenhuma nova dependência prevista; usar Tailwind, CSS variables, React Router e Lucide já instalados

## Referências visuais

- [Mockup aprovado do modo claro](../../../docs/azyboard-wiki/assets/diagramas/board-redesign-light.svg)
- [Mockup aprovado do modo escuro](../../../docs/azyboard-wiki/assets/diagramas/board-redesign-dark.svg)
- [Análise e decisões visuais](../../../docs/azyboard-wiki/controle/Proposta%20Visual%20do%20Board.md)
- [Referência da hierarquia de lanes e espaçamento](../../../docs/azyboard-wiki/assets/diagramas/novo.png)
