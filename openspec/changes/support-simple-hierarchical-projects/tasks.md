## 1. Mapear o modelo e os fluxos atuais

- [x] 1.1 Identificar schema, migrações, tipos compartilhados, rotas e serviços que representam projetos, módulos, EPICs, STORYs e cards.
- [x] 1.2 Mapear `ProjectsPage`, `SettingsPage`, `BoardPage`, swimlanes, filtros, Tree View, breadcrumbs, realtime e ferramentas MCP que assumem o modo hierárquico.
- [x] 1.3 Definir nomes, textos traduzíveis e contrato de `boardMode`/`simpleStoryId`, incluindo validação de payload e compatibilidade com projetos existentes.

## 2. Persistir o modo e a história fixa

- [x] 2.1 Adicionar `board_mode` ao projeto com valores `HIERARCHICAL` e `SIMPLE`, default hierárquico, e atualizar os tipos compartilhados.
- [x] 2.2 Adicionar referência nullable `simple_story_id` e relações necessárias, com comentários `[TENANT]` e `[DB-SWAP]` nos pontos aplicáveis.
- [x] 2.3 Gerar e executar migração compatível com SQLite, verificando a estratégia equivalente para PostgreSQL/Supabase.
- [x] 2.4 Criar helpers pequenos e tenant-aware para localizar/criar a STORY fixa e recalcular `ancestryPath`.

## 3. Implementar criação e conversão no backend

- [x] 3.1 Aceitar `boardMode` na criação de projeto, aplicar o default e provisionar STORY fixa e colunas no modo simples sem criar módulo/EPIC desnecessário.
- [x] 3.2 Fazer `GET /projects` e `GET /projects/:id` retornarem modo e referência da STORY fixa.
- [x] 3.3 Permitir `boardMode` em `PATCH /projects/:id` somente para ADMIN, com filtros de tenant e membership.
- [x] 3.4 Implementar conversão hierárquico → simples em transação, preservando TASKs/BUGs, IDs, conteúdo, relações e colunas; achatar seus `parentId` para a STORY fixa.
- [x] 3.5 Remover módulos e EPICs somente depois de atualizar referências e breadcrumbs, sem deixar registros órfãos ou excluir cards.
- [x] 3.6 Implementar conversão simples → hierárquico reutilizando a STORY fixa sob módulo `Geral` e EPIC `Fluxo contínuo`, sem duplicação.
- [x] 3.7 Definir respostas de sucesso, conflito, 403, 404 e rollback para falhas de conversão.

## 4. Adaptar criação, consulta e integrações de itens

- [x] 4.1 Ajustar criação e edição de TASK/BUG para apontar automaticamente à STORY fixa no modo simples, sem exigir módulo ou EPIC.
- [x] 4.2 Ajustar consultas de board, filtros, progresso, pontuação, reorder, move, tags, sprints, anexos, checklists e logs para o fluxo simples.
- [x] 4.3 Adaptar Tree View, breadcrumbs e eventos realtime para representar o modo simples sem inventar módulo/EPIC.
- [x] 4.4 Atualizar ferramentas MCP e validações de API para criarem/listarem itens simples sem exigir `moduleId`.

## 5. Implementar a interface

- [x] 5.1 Adicionar seletor de modo ao formulário de criação de projeto, com hierárquico selecionado por padrão e descrição das diferenças.
- [x] 5.2 Exibir o modo atual em Settings e permitir alteração somente para ADMIN.
- [x] 5.3 Implementar confirmação específica antes de converter hierárquico para simples, informando remoção de módulos/EPICs e preservação dos cards.
- [x] 5.4 Renderizar o board simples como fluxo único com STORY fixa e colunas, ocultando swimlanes de módulo/EPIC e controles de expansão incompatíveis.
- [x] 5.5 Adaptar filtros, criação de cards, navegação, breadcrumbs, estados vazios e responsividade para ambos os modos.
- [x] 5.6 Atualizar estado local/realtime somente após conversão bem-sucedida e exibir erro sem perder a seleção atual.

## 6. Testes e verificação

- [x] 6.1 Testar migração de schema e default hierárquico para projetos existentes.
- [x] 6.2 Testar criação simples, criação hierárquica e retorno de modo nos endpoints.
- [ ] 6.3 Testar conversão nos dois sentidos com TASKs, subtasks, BUGs, tags, sprints, anexos, checklists, logs e colunas, confirmando preservação e rollback.
- [x] 6.4 Testar autorização ADMIN, bloqueio de MEMBER/VIEWER e isolamento cross-tenant.
- [ ] 6.5 Testar interface: seletor, confirmação, cancelamento, board único, filtros, árvore, breadcrumbs, drag-and-drop e regressão hierárquica.
- [ ] 6.6 Executar typecheck, lint, testes e build de todos os apps, corrigindo regressões.
