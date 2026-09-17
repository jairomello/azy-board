## Context

`EpicModal` e `StoryModal` são os últimos formulários de item que ainda usam o padrão estreito com accordions. `ItemModal` (TASK/BUG) já foi reorganizada em diálogo amplo com cabeçalho contextual, navegação por áreas (`Detalhes`, `Subtasks`, `Checklists`, `Histórico`) e painel de propriedades. As modais de épico e história continuam em `max-w-md`/`max-w-2xl`, com accordions empilhados e sem acesso a recursos relacionados.

A API já é genérica por `itemId`: `GET /projects/:projectId/items/:itemId/children`, rota aninhada de checklists, `GET /items/:itemId/audit`, `GET/POST/PATCH/DELETE /items/:itemId/work-log` e `PATCH /items/:itemId` atendem qualquer tipo de item, respeitando tenant, projeto e RBAC. Portanto a mudança é de frontend, sem endpoint novo.

Restrições: preservar payloads e validações existentes de `POST/PATCH /projects/:id/items`; não introduzir campos de negócio novos em épico/história; manter PT-BR como padrão e cobertura EN/ES; não adicionar dependências.

## Goals / Non-Goals

**Goals:**

- Levar a `EpicModal` e `StoryModal` o mesmo padrão visual, de navegação e de acessibilidade da modal de task.
- Expor subtasks, checklists e histórico (auditoria e diário) para épico e história reutilizando os componentes e endpoints atuais.
- Manter `Detalhes` como área inicial, com o conteúdo rico e os campos que cada tipo já possui.
- Garantir resposta de layout consistente em desktop, tablet e mobile, sem rolagem horizontal e com ações sempre acessíveis.
- Preservar criação, edição, defaults, erros, cancelamento e abertura de filhos, inclusive o tipo correto da modal do filho.

**Non-Goals:**

- Alterar endpoints, tabelas, validações de domínio ou a semântica dos campos de épico e história.
- Adicionar status, responsável, prioridade, pontos, sprint ou datas editáveis a épico/história.
- Expor checklists ou diário de trabalho em épico e história; o diário permanece exclusivo de task, subtask e bug.
- Migrar `ItemModal` para os novos componentes compartilhados nesta mudança; ela permanece como está e será reconciliada depois.
- Criar pilha de modais misturando tipos (épico empilhando história, por exemplo) além do que já existe.
- Persistir a área ativa ou qualquer preferência visual do modal.

## Decisions

### 1. Adotar o padrão de casca da task em épico e história

`EpicModal` e `StoryModal` passam a renderizar um diálogo amplo `max-w-[1120px]`, com altura limitada ao viewport, cabeçalho e rodapé fixos e apenas o conteúdo intermediário rolável. O cabeçalho traz ícone do tipo via `itemTypeMeta`, breadcrumb de contexto, título com `InlineEdit`, badges de tipo/código e botão de fechar; o rodapé traz Cancelar e Salvar com ícones e estado de loading.

Alternativa descartada: manter as modais estreitas e apenas ajustar espaçamento. Isso perpetuaria a inconsistência e não resolveria o acesso aos recursos relacionados.

### 2. Extrair primitivas compartilhadas de apresentação

Extrair três componentes de apresentação — cabeçalho de detalhe, navegação por áreas e painel de propriedades — e usá-los em épico e história. Eles replicam a marcação da `ItemModal` para permitir adoção futura sem divergência visual.

Alternativa descartada: duplicar o markup diretamente em cada modal. Seriam três implementações independentes da mesma casca, com alto risco de divergência. A migração da `ItemModal` para as primitivas fica como melhoria posterior para não misturar refatoração com redesenho.

### 3. Navegação por áreas com estado local e filhos por tipo

Cada modal mantém um estado local de área ativa iniciando em `details`. As áreas são `details`, `children` e `activity`, com `role="tab"`, `aria-selected` e `aria-controls`. A área `children` é variável conforme o tipo do item: épico lista Histórias, história lista Tasks e task/subtask lista Subtasks, com título e estado vazio próprios, passados para `CardChildrenSection`.

Alternativa descartada: manter accordions dentro de `Detalhes`. Duplicaria a navegação (abas e accordions) e contrariaria o padrão adotado.

### 4. Histórico restrito à auditoria em épico e história

A área `Histórico` de épico e história exibe apenas a auditoria de alterações (`ActivityLogPanel`). O diário de trabalho não é exposto, pois a funcionalidade é exclusiva de task, subtask e bug. Checklists também não são expostos nessas duas modais.

Alternativa descartada: reutilizar `WorkLogPanel` e `ChecklistSection` para épico/história só porque a API aceita qualquer `itemId`. A API genérica não implica suporte de produto, e a UI passaria a sugerir um fluxo que não existe.

### 5. Painel de propriedades restrito aos campos atuais

O painel lateral mostra somente o que cada tipo já possui: Épico (Módulo obrigatório, Versão opcional, Código) e História (Épico pai obrigatório, Versão opcional, Código). Nenhum campo de negócio novo é exposto e os payloads de criação/edição permanecem idênticos.

Alternativa descartada: igualar o painel ao da task com status, prioridade, responsável, pontos e datas. Isso alteraria payloads e o significado de épico/história e está fora do escopo.

### 6. `Detalhes` concentra o conteúdo rico existente

Épico mantém a descrição rica em `Detalhes`. História mantém narrativa (Como/Eu quero/Para que), descrição, critérios de aceitação e notas como blocos de conteúdo na área principal, com os campos de relacionamento no painel lateral. O `RichTextEditor` continua sendo o componente único.

Alternativa descartada: transformar narrativa, critérios e notas em pequenos campos de propriedades. Isso reduziria a área de edição de texto, que é o conteúdo principal desses itens.

### 7. Recursos relacionados por `itemId`, sem backend novo

As áreas `children` e `Histórico` reutilizam `CardChildrenSection` e `ActivityLogPanel`. Falhas de consultas auxiliares não podem impedir editar ou salvar os campos principais; cada painel mantém seus estados de loading, vazio, erro e retry.

Alternativa descartada: criar endpoints ou visões específicos para épico/história. Seria trabalho sem ganho, pois os recursos já são por item genérico.

### 8. Abertura de filhos respeitando o tipo

`CardChildrenSection` informa o tipo do filho na abertura; a modal delega ao dispatcher do `BoardPage`, que abre `StoryModal` para `STORY` e `ItemModal` para `TASK`/`BUG`. O limite de profundidade e os callbacks existentes são preservados.

Alternativa descartada: abrir sempre uma nova instância do mesmo tipo de modal. Abriria a modal errada ao clicar em um filho de tipo diferente.

### 9. Reconciliar accordions e espaçamento nas especificações

A capacidade `accordion-item-detail-forms` deixa de exigir accordions nas modais de Épico e História e passa a exigir navegação por áreas; a capacidade `consistent-item-modal-spacing` passa a abranger Épico e História. Nenhum comportamento de accordion é removido de telas que ainda o utilizam.

Alternativa descartada: manter a especificação de accordion intacta. A implementação nova a violaria e deixaria a especificação divergente da realidade.

## Risks / Trade-offs

- **[Regressão na criação/edição de épico e história]** → manter `handleSave`, payloads e defaults; cobrir criação, edição, cancelamento e erro em testes de contrato.
- **[Duplicação temporária da casca em relação à `ItemModal`]** → primitivas replicam a marcação atual e ficam prontas para adoção posterior; testes verificam paridade estrutural.
- **[Modal ampla exceder viewport ou esconder ações]** → limitar altura, rolar apenas o conteúdo, fixar cabeçalho/rodapé e validar breakpoints.
- **[Falha de consulta auxiliar bloquear o formulário]** → isolamento por painel, com estados de erro e retry independentes.
- **[Contagens desatualizadas após criar filho/checklist]** → atualizar via callbacks e refresh keys existentes.
- **[Abertura de filho de tipo diferente na modal errada]** → dispatcher por tipo com testes cobrindo `STORY` e `TASK`/`BUG`.
- **[Escape/foco quebrando com abas e painéis]** → um listener de Escape por nível, foco visível e `aria-*` consistentes.

## Migration Plan

1. Extrair as primitivas de apresentação e validar que a `ItemModal` continua com seus testes atuais passando.
2. Migrar `EpicModal` para o novo layout, começando por `Detalhes` e painel de propriedades.
3. Migrar `StoryModal` mantendo narrativa, critérios e notas em `Detalhes`.
4. Integrar as áreas de Subtasks, Checklists e Histórico com os painéis e callbacks por `itemId`.
5. Ajustar abertura de filhos por tipo no `BoardPage` e validar a stack existente.
6. Atualizar traduções PT-BR/EN/ES e testes de contrato, acessibilidade e responsividade.
7. Executar `bun run check` e `bun run test:smoke`.
8. Rollback: reverter os componentes das modais; não há migração de banco nem alteração de API.

## Open Questions

- O empilhamento misto de modais (abrir filho de tipo diferente sobre a modal atual) será resolvido com o dispatcher do `BoardPage` apenas se o estado atual permitir; caso contrário, a modal atual é substituída pela do filho, sem inventar nova pilha.
- Validar em mobile se o painel de propriedades empilhado é suficiente ou se precisa de uma seção colapsável dedicada.
