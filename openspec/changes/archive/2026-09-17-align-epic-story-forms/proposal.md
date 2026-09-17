## Why

A modal de task foi reorganizada em um padrão amplo, com cabeçalho contextual, navegação por áreas e painel de propriedades, mas `EpicModal` e `StoryModal` continuam estreitas, verticais e dependentes de accordions. A inconsistência obriga o usuário a percorrer formulários longos, esconde recursos já suportados pela API (subtasks, checklists e histórico por `itemId`) e diverge em acessibilidade e responsividade.

## What Changes

- Reestruturar `EpicModal` e `StoryModal` no mesmo modelo da modal de task: diálogo amplo e responsivo, backdrop, cabeçalho contextual com ícone do tipo, título editável inline, badges de tipo/código e ações fixas de Cancelar/Salvar.
- Adicionar navegação por áreas com `Detalhes`, a lista de filhos e `Histórico`, incluindo contagens e resumos, iniciando em `Detalhes`.
- Tornar a área de filhos dependente do tipo do item: épico lista Histórias, história lista Tasks e task/subtask lista Subtasks, com título e estado vazio próprios.
- Manter o conteúdo rico atual em `Detalhes`: descrição do épico; narrativa (Como/Eu quero/Para que), descrição, critérios de aceitação e notas da história.
- Criar painel de propriedades lateral com os campos já existentes de cada tipo: Épico (Módulo, Versão, Código) e História (Épico pai, Versão, Código).
- Reutilizar `CardChildrenSection` e `ActivityLogPanel` por `itemId`, sem criar endpoint novo. Épico e história NÃO expõem checklists nem diário de trabalho; o diário permanece restrito a task, subtask e bug.
- Substituir os accordions desses dois formulários por navegação por áreas, reconciliando a capacidade `accordion-item-detail-forms` com o padrão já adotado pela task.
- Aplicar espaçamento, hierarquia visual, foco visível, `role="dialog"`, `aria-modal`, navegação por teclado e traduções PT-BR/EN/ES consistentes.
- Abertura de filhos passa a respeitar o tipo do filho (STORY abre `StoryModal`; TASK/BUG abre `ItemModal`), sem empilhar modal incorreta.

## Capabilities

### New Capabilities

Nenhuma. A mudança reutiliza recursos e capacidades existentes, sem introduzir domínio funcional novo.

### Modified Capabilities

- `epic-story-ui`: `EpicModal` e `StoryModal` passam a oferecer layout amplo, cabeçalho contextual, navegação por áreas (Detalhes, lista de filhos por tipo e Histórico), painel de propriedades e ações fixas, preservando campos, payloads e regras existentes.
- `accordion-item-detail-forms`: as modais de Épico e História deixam de exigir accordions e passam a usar navegação por áreas, restringindo o requisito de accordion às telas que ainda o utilizam.
- `consistent-item-modal-spacing`: o espaçamento e a hierarquia consistentes entre grupos de label e controle passam a valer também para Épico e História.

## Impact

- Frontend: `EpicModal`, `StoryModal`, `BoardPage` (abertura, callbacks de filhos e contagens), componentes compartilhados (`CardChildrenSection`, `ActivityLogPanel`, `itemTypeMeta`) e testes de contrato.
- Internacionalização: chaves das namespaces `board` e `common` nos três idiomas suportados.
- API/backend: sem alteração. Os endpoints `GET /items/:itemId/children`, `audit` e o `PATCH /items/:itemId` já operam por `itemId` genérico e permanecem como estão; checklists e `work-log` seguem disponíveis na API mas não são expostos para épico/história.
- Acessibilidade: foco, `aria-*`, navegação por teclado, Escape e leitura de áreas/seções.
- Responsividade: duas colunas no desktop e composição empilhada no mobile, sem rolagem horizontal.
- Dependências: nenhuma nova; reutilizar Tailwind, Lucide, Tiptap e componentes atuais.
