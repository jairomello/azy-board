## Context

O Azy Board possui uma tela de login com layout de card dois painéis (marketing à esquerda, formulário à direita) centralizado na viewport. O painel direito usa `flex items-center justify-center` com padding generoso (`lg:p-16`), mas o formulário de login ocupa quase toda a altura disponível, deixando pouco espaço de respiro vertical.

No board, a hierarquia visual atual é Épico >> História >> Cards. Módulos já existem no sistema como agrupadores de épicos (com CRUD em Settings e filtro no board), mas não são renderizados como nível visual collapsível no board. O toolbar do board possui 4 botões de criação: `+ Épico`, `+ História`, `+ Task`, `+ Bug`.

## Goals / Non-Goals

**Goals:**
- Redesenhar o layout da LoginPage para que o box de login seja mais compacto verticalmente, com margens superior e inferior maiores, centralizando o formulário no card
- Preparar a estrutura da LoginPage para suportar uma imagem de papel de parede no fundo (sem implementar a imagem agora)
- Adicionar Módulo como nível visual collapsível no board, acima do Épico (Módulo >> Épico >> História >> Cards)
- Adicionar botão "+ Módulo" no toolbar de criação do board

**Non-Goals:**
- Não implementar a imagem de papel de parede nesta mudança (apenas preparar a estrutura)
- Não alterar o modelo de dados de módulos (já existe `moduleId` nos items e tabela `modules`)
- Não alterar a lógica de CRUD de módulos (já existe em Settings)
- Não modificar a API de items ou módulos

## Decisions

### Decisão 1: Login — Reduzir padding vertical e limitar altura do formulário

**Escolha:** Alterar o padding do painel direito de `lg:p-16` para `lg:py-20 lg:px-12` e adicionar `max-h` no conteúdo interno do formulário para evitar que ele estique verticalmente.

**Alternativa considerada:** Usar `h-full` no formulário com `my-auto` para centralizar. Rejeitada porque não dá controle fino sobre o tamanho do box e pode causar overflow em telas menores.

**Rationale:** Aumentar o padding vertical (`py-20` vs `p-16` que era ~64px) cria mais espaço de respiro. O `max-h` no conteúdo interno garante que o formulário não estique além do necessário, mantendo-o compacto e centralizado.

### Decisão 2: Login — Estrutura para papel de parede futuro

**Escolha:** Adicionar uma `div` absoluta de fundo no painel esquerdo (e opcionalmente no direito) com `bg-cover bg-center` pronta para receber uma imagem via prop ou variável CSS. Por enquanto, sem imagem — apenas a estrutura.

**Rationale:** Manter a estrutura preparada mas sem imagem evita trabalho duplicado quando o papel de parede for implementado. A `div` absoluta não interfere no layout atual.

### Decisão 3: Board — ModuleSwimlane como wrapper das swimlanes de Épico

**Escolha:** Criar um novo componente `ModuleSwimlane` que agrupa as swimlanes de Épico pertencentes ao mesmo módulo. Cada `ModuleSwimlane` é collapsível e exibe o nome do módulo no header.

**Alternativa considerada:** Modificar o componente `Swimlane` existente para suportar dois níveis. Rejeitada porque complicaria a lógica existente e misturaria responsabilidades.

**Rationale:** Um componente separado mantém a lógica de agrupamento por módulo isolada e reutilizável. O `Swimlane` de Épico continua inalterado, apenas aninhado dentro do `ModuleSwimlane`.

### Decisão 4: Board — Agrupamento de épicos por módulo no BoardPage

**Escolha:** No `BoardPage`, após calcular `epicGroups`, agrupar os épicos por `moduleId` para gerar `moduleGroups`. Cada grupo de módulo contém seus épicos, que por sua vez contêm suas histórias.

**Rationale:** O `moduleId` já existe nos items (épicos). O agrupamento é feito no frontend a partir dos dados já carregados, sem necessidade de nova query na API.

### Decisão 5: Toolbar — Adicionar "+ Módulo" como primeiro botão

**Escolha:** Adicionar o botão "+ Módulo" como o primeiro botão do grupo de criação no toolbar, antes de "+ Épico". O botão abre uma modal simples de criação de módulo (nome + descrição opcional).

**Rationale:** Módulo é o nível mais alto da hierarquia, faz sentido ser o primeiro botão. A modal de criação de módulo é simples (apenas nome e descrição) pois o CRUD completo já existe em Settings.

## Risks / Trade-offs

- **[Risco] ModuleSwimlane adiciona profundidade visual** → Mitigação: Usar indentação sutil e cores distintas para diferenciar os níveis Módulo/Épico/História. O Módulo usa um tom mais neutro para não competir visualmente com o Épico.

- **[Risco] Login com padding maior pode causar overflow em telas pequenas** → Mitigação: Manter padding responsivo (`py-10` mobile, `py-16` sm, `py-20` lg) e usar `overflow-y-auto` no card externo se necessário.

- **[Trade-off] ModuleSwimlane sempre visível mesmo com 1 módulo** → Aceito: Mesmo com um único módulo, mostrar o nível Module mantém consistência visual e prepara para quando o projeto crescer. Pode ser revisitado no futuro com uma opção de "ocultar nível módulo quando único".

- **[Risco] Performance com agrupamento aninhado** → Mitigação: O agrupamento é feito em memória no frontend com dados já carregados. Para projetos com muitos módulos/épicos, usar `useMemo` para evitar recálculos.
