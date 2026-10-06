## ADDED Requirements

### Requirement: Ferramentas MCP de links do item

O servidor MCP SHALL expor `list_item_links`, `create_item_link`, `update_item_link` e `delete_item_link`, reaproveitando o CRUD de links da API sob `/projects/:projectId/items/:itemId/links`. A listagem SHALL retornar apenas os links do item no tenant/projeto autorizados; a criação SHALL persistir nome, URL e descrição opcional; a edição SHALL alterar somente os campos enviados; e a remoção SHALL excluir o link indicado. Leitura SHALL exigir acesso de leitura ao projeto e mutações SHALL exigir permissão de escrita, com isolamento por tenant/projeto/item. As respostas de mutação SHALL permitir confirmar o link afetado por `id`, `name` e `url`, e erros SHALL seguir o envelope normalizado. As ferramentas NÃO SHALL ler, baixar ou interpretar o conteúdo da URL.

#### Scenario: Listar links do item

- **WHEN** o agente invoca `list_item_links` com `{ projectId, itemId }` sobre um item acessível
- **THEN** o servidor retorna somente os links daquele item, com `id`, `name`, `url` e `description`

#### Scenario: Criar link

- **WHEN** o agente invoca `create_item_link` com `{ projectId, itemId, name, url }` e, opcionalmente, `description`
- **THEN** o link é persistido e a resposta permite confirmar nome e URL sem releitura pesada

#### Scenario: Editar link

- **WHEN** o agente invoca `update_item_link` com `{ projectId, itemId, linkId }` e um ou mais de `name`/`url`/`description`
- **THEN** somente os campos enviados são alterados e a resposta devolve o link atualizado

#### Scenario: Remover link

- **WHEN** o agente invoca `delete_item_link` com `{ projectId, itemId, linkId }`
- **THEN** o link é excluído e deixa de aparecer em `list_item_links`

#### Scenario: URL inválida não persiste

- **WHEN** o agente invoca `create_item_link` com URL inválida ou esquema diferente de HTTP/HTTPS
- **THEN** o servidor retorna erro de validação acionável e nenhum link é criado

#### Scenario: Permissão e isolamento

- **WHEN** um agente sem permissão de escrita tenta criar/editar/remover, ou tenta acessar link de outro tenant/projeto/item
- **THEN** a operação é rejeitada sem revelar dados nem alterar registros

#### Scenario: Cadastrar URL não acessa o serviço externo

- **WHEN** o agente cria um link para uma URL externa
- **THEN** a operação apenas persiste os metadados e não requisita nem interpreta o conteúdo da URL
