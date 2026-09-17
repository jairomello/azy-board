## Context

O board já possui `ItemModal` para criar e editar TASK/BUG e usa `BoardPage` para carregar catálogos, abrir modais e persistir alterações. O modal atual é um painel vertical `max-w-2xl` que combina propriedades, rich text, subtasks, checklists, atividade e work log em accordions. `StoryModal` e `EpicModal` já reutilizam `AccordionSection` e `AccordionToolbar`, enquanto `AddCardForm` continua sendo o fluxo compacto inline da criação por coluna.

O alvo visual é `docs/mockups/task-form-01-modal-ampla.png` (1774 x 887): backdrop sobre o board, modal central ampla com cabeçalho contextual e ações de navegação, navegação horizontal por áreas, conteúdo principal à esquerda e propriedades persistentes à direita. O protótipo é referência de composição e hierarquia, não de dados novos.

Restrições: manter os contratos atuais de `POST/PATCH /projects/:id/items`, regra de tasks folha, RBAC e isolamento multi-tenant; não adicionar dependências; manter PT-BR como idioma padrão e cobertura EN/ES.

## Goals / Non-Goals

**Goals:**

- Dar acesso rápido às propriedades mais usadas sem obrigar o usuário a percorrer um formulário vertical longo.
- Reorganizar a `ItemModal` em cabeçalho, navegação de áreas, conteúdo e painel de propriedades, preservando todos os campos atuais.
- Usar uma área principal para descrição rica e recursos relacionados, com contagens atualizadas de subtasks, checklists e histórico.
- Manter o mesmo estado controlado de edição, payload de salvamento, tratamento de erro e modais filhas.
- Garantir navegação por teclado, foco visível, nomes acessíveis, fechamento por Escape e layout utilizável em viewport móvel.
- Diferenciar claramente TASK e BUG e indicar contexto hierárquico por breadcrumb/código sem tornar campos derivados editáveis indevidamente.

**Non-Goals:**

- Alterar endpoints, tabelas, validações de domínio, regras de status ou semântica dos campos.
- Transformar `AddCardForm` inline das colunas em modal; apenas a criação pela toolbar usa o formulário amplo.
- Criar novas capacidades de comentários, anexos, dependências ou edição de histórias/épicos neste change.
- Persistir aba selecionada ou estado visual do modal no backend ou em `localStorage`.
- Reproduzir literalmente dimensões do PNG em todas as telas; o layout deve responder ao espaço disponível.

## Decisions

### 1. Reestruturar `ItemModal`, sem duplicar o formulário

O estado e `handleSave` permanecerão em `ItemModal`; a implementação deve separar visualmente componentes menores apenas onde houver responsabilidade clara, como navegação de áreas, painel de propriedades e cabeçalho. Isso evita divergência entre criação e edição e preserva o payload existente.

Alternativa descartada: criar um `TaskFormModal` paralelo e manter `ItemModal` antigo. Isso duplicaria campos, regras de loading e integrações de subtasks/checklists.

### 2. Usar navegação por áreas com estado local

Adicionar um estado local de área ativa, iniciando em `details`. As áreas serão `details`, `subtasks`, `checklists` e `activity`; a descrição permanece em Detalhes e work log continua acessível a partir de Atividade ou ação equivalente. A navegação será feita por `button` com `role="tab"`, `aria-selected` e `aria-controls`, ou por uma semântica equivalente se a implementação mantiver accordions em mobile.

Alternativa descartada: remover completamente os accordions. Em telas pequenas, as áreas precisam colapsar ou empilhar; reutilizar os componentes existentes reduz regressão e mantém os conteúdos secundários acessíveis.

### 3. Painel de propriedades controlado pelo mesmo estado

O painel direito exibirá status, responsável e prioridade no grupo superior; sprint, versão, pontos e datas em Planejamento; código e autor em Informações. `StorySelector`, `TagSelector` e centro de custo ficarão no conteúdo de Detalhes ou em um grupo de propriedades que não cause overflow. Código e autor continuam com as restrições atuais, inclusive código gerado e autor somente leitura quando aplicável.

Alternativa descartada: transformar todas as propriedades em edição inline sem labels. O protótipo melhora a densidade, mas labels explícitos, estados de foco e controles nativos são mais compatíveis com acessibilidade e com os componentes atuais.

### 4. Cabeçalho contextual e ações fixas

O cabeçalho exibirá tipo, prioridade, código, breadcrumb e coluna/status como contexto, além de fechar e, quando aplicável, navegar entre níveis/itens conforme o fluxo existente. O rodapé manterá Cancelar e Salvar alterações, ficará fixo no modal e terá estado disabled/loading. Em criação, os valores padrão continuam status `NOT_STARTED`, prioridade `MEDIUM`, sem responsável e vínculos opcionais vazios.

Alternativa descartada: colocar Salvar apenas no fim do conteúdo rolável. Isso aumenta o custo da ação e diverge do protótipo.

### 5. Responsividade por mudança de composição

No desktop, usar modal com largura próxima de `min(1120px, calc(100vw - 2rem))`, altura limitada ao viewport e duas colunas. Em telas menores, reduzir padding e empilhar painel de propriedades abaixo do conteúdo ou convertê-lo em seção expansível; nunca permitir rolagem horizontal. O cabeçalho e rodapé permanecem fixos dentro do modal, com conteúdo intermediário rolável.

### 6. Preservar stack e efeitos secundários

A abertura de subtask continua usando a stack existente e o limite de profundidade. Ao trocar de área ou abrir editor rico, valores não salvos permanecem no estado da modal. Checklists, histórico, work log e contagens seguem as APIs já chamadas por `ItemModal`; falhas de dados auxiliares não devem impedir editar e salvar os campos principais.

## Risks / Trade-offs

- **[Perda de descoberta de campos secundários]** → manter labels de áreas, contagens, ícones, estados vazios e primeira área aberta.
- **[Modal ampla exceder viewport ou ocultar ações]** → limitar altura, rolar apenas o conteúdo e testar breakpoints desktop/tablet/mobile.
- **[Divergência entre criação e edição]** → usar a mesma `ItemModal` e cobrir os dois caminhos nos testes de contrato.
- **[Navegação por abas quebrar Escape ou foco das modais filhas]** → manter listener de Escape por nível e testar foco ao abrir/fechar conteúdo sobreposto.
- **[Contagens desatualizadas após criação de subtask/checklist]** → derivar resumos dos estados já atualizados e manter callbacks de refresh existentes.
- **[Mudança visual afetar testes estruturais antigos]** → atualizar testes que validam layout, preservando testes de payload, acessibilidade e comportamento.

## Migration Plan

1. Criar componentes visuais e contratos de navegação sem alterar API.
2. Migrar `ItemModal` para o layout amplo, começando por Detalhes e painel de propriedades.
3. Integrar Subtasks, Checklists, Atividade, Work Log, rich text expandido e stack de filhos.
4. Atualizar abertura pela toolbar e garantir que criação por coluna continue compacta.
5. Atualizar traduções e testes de contrato/responsividade/acessibilidade.
6. Executar `bun run check` e `bun run test:smoke`.
7. Rollback: reverter a composição visual de `ItemModal`; não há migração de banco nem alteração de API para desfazer.

## Open Questions

- A navegação entre cards no cabeçalho do protótipo não está presente no contrato atual. Nesta mudança ela deve ser implementada apenas se já houver dados/handlers reutilizáveis; caso contrário, manter somente fechar e o retorno da stack de filhos, sem inventar ordenação.
- Em mobile, validar durante a implementação se o painel de propriedades empilhado ou um accordion dedicado oferece melhor usabilidade sem perder a correspondência com o protótipo.
