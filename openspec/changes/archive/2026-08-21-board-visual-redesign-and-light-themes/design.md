## Context

O frontend atual renderiza a tela inteira dentro de `BoardPage.tsx`. Header, toolbar, Board e modais compartilham o mesmo componente. `BoardFilters` controla filtros e toggles, enquanto `KanbanCard` renderiza o conteúdo dos cards. Os tokens globais seguem a estrutura básica `background`, `card`, `muted`, `primary` e `border`.

O tema atual possui duas dimensões persistidas parcialmente:

- `theme: 'light' | 'dark'`
- `language: 'pt-BR' | 'en' | 'es'`

O frontend já tenta executar `PATCH /api/users/me`, mas a rota não está registrada na API atual. A implementação desta mudança deve consolidar esse contrato, e não adicionar novas chamadas `fetch` isoladas.

## Estado consolidado da implementação

O shell, os presets claros, a API de preferências, a seção Aparência, a command bar e o status rail foram implementados. Durante a consolidação visual, o Board também passou a representar histórias como lanes aninhadas por padrão, mantendo o modo anterior de histórias como cards como alternativa. A Wiki e as delta specs registram essa ampliação de escopo.

## Goals / Non-Goals

### Goals

- Aplicar a direção visual aprovada sem alterar as regras de negócio do Board
- Criar uma identidade reconhecível e consistente nos modos claro e escuro
- Separar navegação, comandos e conteúdo em camadas funcionais claras
- Permitir que cada usuário escolha o shell do modo claro
- Persistir preferências sem flash de tema incorreto
- Manter todos os controles funcionais, acessíveis e responsivos
- Reduzir o tamanho e a responsabilidade de `BoardPage.tsx`
- Representar a hierarquia Épico → História → Cards diretamente no Kanban
- Preservar o comportamento anterior de histórias como cards como modo alternativo

### Non-Goals

- Implementar Timeline, Insights, notificações ou presença apenas porque aparecem no estudo visual
- Exibir links, botões ou indicadores sem comportamento funcional
- Aceitar uma cor HEX arbitrária na primeira versão
- Alterar permissões ou a Leaf Rule de TASK/BUG
- Redesenhar todos os modais da aplicação nesta mesma entrega
- Trocar bibliotecas de UI, ícones ou drag and drop

## Decisions

### 1. Shell reutilizável fora de BoardPage

Criar componentes orientados a responsabilidade:

```text
AppShell
├── WorkspaceSidebar
├── WorkspaceHeader
├── BoardCommandBar
├── BoardContextHeader
├── BoardCanvas
│   ├── SwimlaneHeader
│   ├── KanbanColumn
│   └── KanbanCard
└── BoardStatusRail
```

`BoardPage` continua responsável por carregar dados e coordenar eventos, mas delega layout e apresentação. A sidebar deve receber itens por configuração e renderizar somente destinos existentes. No primeiro lote, os destinos válidos são Projetos, Board/Árvore, Configurações do projeto e Conta.

### 2. Glass restrito a navegação e controles

Sidebar, header, command bar e status rail podem usar transparência controlada e elevação. Swimlanes, colunas e cards permanecem sólidos. Não usar blur ou transparência em superfícies que contenham texto operacional denso.

### 3. Tokens semânticos para o shell

Adicionar tokens próprios, sem sobrecarregar `primary`:

```css
--canvas
--surface
--surface-raised
--surface-floating
--shell-sidebar
--shell-header
--shell-border
--shell-foreground
--shell-muted
--shell-active
--shell-accent
--status-progress
--status-review
--status-done
--status-blocked
```

Componentes não devem conter as cores aprovadas diretamente em classes Tailwind. A aplicação escolhe os valores por `data-light-shell-theme` no elemento `<html>`.

### 4. Presets do modo claro

O tipo compartilhado será:

```ts
export type LightShellTheme =
  | 'petroleum'
  | 'ocean'
  | 'emerald'
  | 'graphite'
  | 'classic'
```

Tokens iniciais:

| Preset | Sidebar | Header | Borda | Item ativo | Accent |
|---|---|---|---|---|---|
| Petróleo | `#0B4651` | `#0E4B56` | `#1D6872` | `#185A64` | `#50E3C2` |
| Oceano | `#123B67` | `#164777` | `#2D628F` | `#1E5A8C` | `#67C7FF` |
| Esmeralda | `#125244` | `#146052` | `#2D7668` | `#1E7061` | `#69E0B5` |
| Grafite | `#272B31` | `#30353C` | `#484F59` | `#414852` | `#8B7CFF` |
| Clássico | `#FFFFFF` | `#FFFFFF` | `#DCE3EC` | `#EFEEFF` | `#635BFF` |

Cada preset define também `shell-foreground` e `shell-muted` com contraste WCAG AA. `classic` funciona como retorno ao shell branco anterior. O preset petróleo é o default aprovado para usuários novos e existentes após a migração.

### 5. Preferência separada do modo claro/escuro

`theme` continua controlando o modo. `lightShellTheme` controla apenas o shell quando `theme === 'light'`.

- Ao entrar no modo escuro, o preset claro permanece salvo, mas não altera os tokens escuros
- Ao voltar ao modo claro, o preset anterior é restaurado
- Trocar o preset em `/account` atualiza a prévia imediatamente e persiste em seguida
- Em caso de erro da API, manter o valor local, mostrar feedback e permitir nova tentativa
- Valores desconhecidos vindos do banco ou `localStorage` devem cair em `petroleum`

### 6. Bootstrap antes do React

`main.tsx` deve aplicar antes do primeiro render:

```ts
document.documentElement.classList.toggle('dark', theme === 'dark')
document.documentElement.dataset.lightShellTheme = lightShellTheme
```

Usar as chaves:

- `theme`
- `light-shell-theme`

Após login ou `/auth/me`, o valor do servidor sincroniza o `localStorage`, o `dataset` e o estado do usuário no `AuthContext`.

### 7. API única de preferências

Criar `usersRouter` protegido por `authMiddleware`:

```http
PATCH /api/users/me
Content-Type: application/json

{
  "theme": "light",
  "lightShellTheme": "petroleum",
  "language": "pt-BR"
}
```

Todos os campos são opcionais, mas ao menos um deve ser informado. A rota deve:

- Validar enums em runtime
- Obter `userId` e `tenantId` exclusivamente do contexto autenticado
- Atualizar com filtros por `users.id` e `users.tenantId`
- Retornar o usuário atualizado sem dados sensíveis
- Rejeitar campos desconhecidos ou valores inválidos com `400`

`AuthContext` deve expor uma função `updatePreferences` que usa `api.patch`, atualiza o usuário em memória e aplica os efeitos locais. `ThemeToggle` e `LanguageSelector` devem parar de usar `fetch` diretamente.

### 8. Preferência em Aparência

Adicionar uma seção não aninhada **Aparência** em `/account`, antes de API Keys:

- Segmented control ou toggle para Claro/Escuro
- Grid de swatches para os cinco presets claros
- Nome e pequena prévia de sidebar/header em cada opção
- Check visível no preset ativo
- Estado de foco e seleção operável por teclado
- Presets continuam selecionáveis no modo escuro, com texto indicando que serão aplicados ao retornar ao claro

Não usar um `<select>` textual: a decisão é visual e deve ser representada por swatches.

### 9. Command bar funcional

A command bar deve preservar os filtros existentes e consolidar criação. Nenhum item decorativo será aceito:

- Board/Árvore: segmented control funcional
- Filtros: abre painel ou popover com contador e ação Limpar
- Squad e Módulo: quick filters quando houver espaço
- Densidade: no primeiro lote, controla `comfortable | compact` e persiste localmente
- Criar: menu com Épico, História, Task e Bug, respeitando permissões
- Arquivados e expandir/recolher: permanecem acessíveis no menu de ações ou no painel de filtros

A busca do mockup pode ser entregue como busca client-side por ID e título nos itens carregados. Se não for implementada no mesmo lote, a área não deve ser renderizada como campo falso.

### 10. Contexto e status operacional

O cabeçalho do Board deve mostrar apenas informações calculáveis:

- Nome do projeto
- Sprint ativa, quando houver
- Itens concluídos e total da sprint
- Percentual de conclusão
- Estado do WebSocket: conectando, sincronizado ou offline
- Quantidade de itens visíveis após filtros

Presença online e notificações ficam condicionadas a capabilities futuras.

### 11. Hierarquia do Board

- EPICs usam uma lane principal com título, total de histórias, cards e progresso
- Por padrão, STORYs usam lanes horizontais aninhadas com accordion independente
- O toggle alterna `storyDisplay` entre `lanes` e `cards`; `lanes` é o default
- `hideEmptyStories` existe somente no modo de lanes
- Cards com EPIC, mas sem STORY ancestral, usam o agrupamento `Sem história`
- Colunas exibem nome, contagem e WIP quando configurado
- O conteúdo da coluna inicia 10px abaixo do cabeçalho
- Cards usam raio máximo de `8px`, borda de status e elevação somente em hover/drag
- Tipo, ID, título, tags, prioridade, checklist, pontos e responsável mantêm comportamento atual
- Cores de tipo e status não podem ser a única forma de comunicar significado
- A área de adicionar card permanece contextual em cada coluna
- Em uma lane de STORY, a criação contextual envia o ID da história como `parentId`
- Estados recolhidos de EPICs e STORYs são persistidos separadamente por projeto

### 12. Responsividade

- `>= 1280px`: sidebar expandida com labels
- `1024px–1279px`: sidebar recolhida para ícones com tooltips
- `< 1024px`: sidebar em drawer; header reduzido; filtros em popover
- O Board mantém scroll horizontal e largura estável de colunas
- Nenhum controle pode aumentar a altura da toolbar por quebra de linha

## Data Model

Adicionar à tabela `users`:

```ts
lightShellTheme: text('light_shell_theme', {
  enum: ['petroleum', 'ocean', 'emerald', 'graphite', 'classic'],
}).notNull().default('petroleum')
```

A migração deve preencher usuários existentes com `petroleum`. Seeds e setup também devem declarar o valor explicitamente.

## Accessibility

- Contraste mínimo WCAG AA para texto e ícones funcionais
- Foco visível em sidebar, toolbar, menus e swatches
- `aria-current="page"` na navegação ativa
- `aria-pressed` ou radio semantics nos presets
- Tooltips para botões apenas por ícone
- Navegação completa por teclado
- Respeitar `prefers-reduced-motion`
- Não depender somente de cor para status, seleção ou prioridade

## Risks / Trade-offs

- **Escopo visual amplo:** a extração do shell pode introduzir regressões. Mitigar com componentes incrementais e testes de fluxo antes de remover o layout atual.
- **Preferência duplicada local/remota:** definir o servidor como fonte após autenticação e `localStorage` como bootstrap antes da sessão.
- **Migração altera o visual existente:** `classic` oferece retorno imediato ao shell branco.
- **Presets aumentam combinações de teste:** usar os mesmos tokens e testar contraste automaticamente para todas as opções.
- **Mockup contém capacidades futuras:** omitir controles sem função, mantendo espaços flexíveis no layout.

## Rollout

1. Entregar persistência e tokens sem mudar o layout atual
2. Adicionar a seção Aparência e validar os presets
3. Extrair `AppShell`, sidebar e header
4. Migrar toolbar, contexto e status rail
5. Migrar swimlanes, colunas e cards
6. Adicionar lanes de história aninhadas e o modo alternativo de histórias como cards
7. Validar os dois modos, cinco presets e breakpoints
8. Capturar screenshots finais e atualizar a Wiki

Cada etapa deve compilar e manter o Board utilizável. O layout antigo só deve ser removido depois que o novo shell cobrir Board e Árvore.
