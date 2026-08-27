## Context

O Azy Board atualmente assume o fluxo `Módulo → EPIC → STORY → TASK/BUG`, com lanes aninhadas, breadcrumbs e agregações de progresso/pontos. A imagem de referência mostra a necessidade de um board simples: as mesmas colunas e cards do Kanban são mantidos, mas o usuário acompanha tudo em um único fluxo, sem a estrutura visual de módulos e épicos, sob uma única história fixa.

A mudança atravessa criação e configurações de projetos, schema, API, renderização do board, criação/movimentação de itens, filtros, árvore, breadcrumbs, agregações, realtime e MCP. A conversão precisa preservar dados e ser segura para projetos multi-tenant.

## Goals / Non-Goals

**Goals:**

- Persistir o modo do projeto com `HIERARCHICAL` como default para projetos existentes e novos quando não informado.
- Oferecer seleção do modo na criação e alteração posterior em Settings.
- Renderizar o modo simples como um Kanban único com colunas do projeto, uma STORY fixa e todos os TASKs/BUGs como cards nessa história.
- Converter hierárquico para simples em uma transação, preservando todos os registros TASK/BUG e seus IDs, achatando seus pais para a STORY fixa e removendo módulos/EPICs excedentes.
- Converter simples para hierárquico sem perder cards, reutilizando a STORY fixa sob um módulo e EPIC padrão.
- Garantir que APIs, filtros, breadcrumbs, progresso, árvore, realtime e MCP não assumam a hierarquia quando o projeto é simples.

**Non-Goals:**

- Não criar um terceiro modo ou um editor de layouts customizados.
- Não apagar TASKs/BUGs durante conversão de modo.
- Não alterar a regra de exclusão de projeto ou de cards.
- Não migrar projetos automaticamente para simples; o modo atual permanece hierárquico.
- Não remover o modo Árvore do produto, mas ele poderá apresentar uma visão plana no modo simples.

## Decisions

- **Campo de modo no projeto:** adicionar `board_mode` com valores `HIERARCHICAL` e `SIMPLE`, default `HIERARCHICAL`. O valor fica no projeto, não em preferência do usuário, porque altera a estrutura e o contrato de dados compartilhado por todos os membros. Alternativas consideradas: preferência local, rejeitada por gerar visões incompatíveis; tabela separada, rejeitada por adicionar complexidade sem benefício.
- **Identificação da STORY fixa:** adicionar `simple_story_id` nullable em `projects`, referenciando a STORY usada no modo simples. Isso evita depender do título e permite localizar a história sem consultas ambíguas. A referência será criada/atualizada na mesma transação da conversão. Alternativa considerada: buscar a primeira STORY por nome, rejeitada por não ser estável.
- **Conversão hierárquico → simples:** dentro de transação, criar ou escolher a STORY fixa, selecionar todos os TASK/BUG do projeto com filtro de tenant, atualizar cada um para `parent_id = simple_story_id`, recalcular `ancestry_path`, remover relações de épicos/módulos que não são mais válidas e excluir módulos/EPICs. Tags, sprints, versões, anexos, checklists, logs, colunas, membros e IDs dos cards são preservados. A operação não usará exclusão por título nem chamadas HTTP encadeadas.
- **Conversão simples → hierárquico:** reutilizar a STORY fixa, criar módulo `Geral` e EPIC `Fluxo contínuo` se a estrutura ainda não existir, vincular a STORY ao EPIC e restaurar breadcrumbs/ancestry. Os cards continuam filhos da mesma STORY. A criação de uma nova estrutura, em vez de tentar reconstruir a hierarquia anterior, é determinística e deixa claro que detalhes removidos na conversão não podem ser recuperados.
- **Contrato de API:** `POST /projects` aceita `boardMode`; `GET /projects` e `GET /projects/:id` retornam `boardMode` e `simpleStoryId`; `PATCH /projects/:id` aceita `boardMode` e executa a migração quando alterado. Operações de mudança exigem ADMIN, tenant e membership, e retornam conflito/erro sem modificar parcialmente o projeto.
- **Representação do board simples:** o backend retorna a STORY fixa e seus TASK/BUG, e o frontend usa as colunas existentes sem `ModuleSwimlane` ou `EpicSwimlane`. A história não será um card móvel; apenas seus cards filhos serão arrastáveis. Filtros de módulo ficam ocultos/desabilitados, enquanto filtros de responsável, sprint, tipo e tags continuam disponíveis.
- **Breadcrumbs e agregações:** no modo simples, breadcrumbs começam na história fixa ou exibem apenas o contexto do projeto, sem nomes de módulo/épico. Progresso e pontos são agregados da STORY fixa a partir dos TASK/BUG do board. O modo hierárquico conserva os cálculos e a apresentação atuais.
- **Realtime e MCP:** eventos incluirão o modo do projeto quando relevante. MCP consultará o modo antes de exigir `moduleId`/`parentId`; em modo simples, criação de TASK/BUG apontará para a STORY fixa e listagens não dependerão de módulos.
- **Migração de schema:** usar migração Drizzle compatível com SQLite e PostgreSQL, incluindo os comentários `[TENANT]` e `[DB-SWAP]` nos pontos de isolamento e troca de driver. Foreign keys não serão usadas para executar a conversão implicitamente, pois a mudança exige atualização ordenada de `parent_id` e `ancestry_path`.

## Risks / Trade-offs

- [Conversão descarta a hierarquia de módulos/épicos] → Exigir confirmação explícita, informar que a operação é estrutural e preservar TASKs/BUGs, IDs e conteúdo.
- [Projeto grande torna a conversão demorada] → Executar em uma transação única com atualizações em lote quando possível e bloquear uma segunda alteração enquanto a primeira estiver em andamento.
- [Itens com parentId inválido ou ancestry inconsistente] → Validar todos os itens do projeto antes da conversão e abortar com rollback se houver inconsistência.
- [Filtros e integrações assumem módulo/épico] → Cobrir o modo simples em endpoints, BoardPage e MCP, com testes de regressão para o modo hierárquico.
- [Remoção de épicos afeta referências externas] → Atualizar referências internas antes do delete e retornar o novo contexto do projeto após o commit; não prometer restauração da estrutura removida.

## Migration Plan

1. Adicionar `board_mode` e `simple_story_id` com valores compatíveis com os projetos existentes.
2. Publicar backend que leia o modo e mantenha o fluxo hierárquico como default.
3. Implementar criação, Settings e endpoint transacional de conversão.
4. Publicar a renderização simples e adaptar APIs auxiliares, realtime e MCP.
5. Validar conversões em banco de teste com itens, subtasks, relações e anexos; depois liberar a opção na interface.
6. Em rollback de código, manter as colunas novas e continuar tratando projetos como `HIERARCHICAL`; não executar downgrade destrutivo sem backup.

## Open Questions

- Definir com o produto o texto final da confirmação e se a conversão hierárquico → simples deve exigir uma segunda confirmação por ser irreversível quanto à estrutura.
- Confirmar se a STORY fixa deve ter nome editável em Settings ou nome reservado, como `Fluxo contínuo`.
- Confirmar se o modo simples deve mostrar TASKs pai com filhos como cards; esta proposta preserva e exibe todos os TASK/BUG achatados para não perder nenhum card.
