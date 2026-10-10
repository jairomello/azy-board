# entity-icons Spec Delta

## ADDED Requirements

### Requirement: Catálogo temático ampliado com categorias
O sistema SHALL expor um catálogo de ícones ampliado que cubra, além do acervo atual, domínios de tecnologia/desenvolvimento, ITIL/service management, gestão de projetos e dados/IA, e SHALL organizar o catálogo em categorias estáveis e idênticas para todos os clientes (fonte única no contrato compartilhado). O nome de cada ícone SHALL continuar em kebab-case, e o seletor SHALL permitir filtrar por categoria além da busca textual existente.

#### Scenario: Categorias disponíveis no seletor
- **WHEN** o usuário abre o seletor de ícones de projeto ou item
- **THEN** o seletor exibe um filtro por categoria e, ao selecionar uma categoria, mostra somente os ícones daquela categoria

#### Scenario: Filtro combinado com busca
- **WHEN** o usuário seleciona uma categoria e digita um termo na busca
- **THEN** o seletor exibe apenas os ícones que pertencem à categoria selecionada e cujo nome contém o termo

#### Scenario: Rótulo de categoria traduzido
- **WHEN** o usuário alterna o idioma da interface
- **THEN** os nomes das categorias de ícones são exibidos no PT-BR, EN ou ES conforme o idioma selecionado

### Requirement: Validação uniforme do catálogo em todas as vias de escrita
O sistema SHALL rejeitar `icon` que não pertença ao catálogo em todos os fluxos de escrita, incluindo criação em lote, duplicação de estrutura e tools MCP de criação/edição, retornando erro de validação sem persistir o item. Exceto onde o valor é copiado internamente a partir de dados já validados (duplicação de estrutura), o sistema SHALL rejeitar o valor antes do commit.

#### Scenario: Batch rejeita ícone fora do catálogo
- **WHEN** a criação em lote informa `icon` que não pertence ao catálogo
- **THEN** o sistema retorna erro de validação e não cria o item

#### Scenario: Duplicação rejeita plano com ícone fora do catálogo
- **WHEN** o plano de duplicação de estrutura contém `icon` que não pertence ao catálogo
- **THEN** o sistema retorna erro de validação e não aplica o plano

#### Scenario: MCP rejeita nome fora do catálogo
- **WHEN** um agente informa `icon` fora do catálogo em `create_task`, `update_item` ou `update_items`
- **THEN** a tool retorna erro de validação indicando que o nome não pertence ao catálogo

#### Scenario: Schema exposto do MCP enumera o catálogo
- **WHEN** um cliente inspeciona o schema da tool `create_task` ou do campo `icon` nas tools de escrita
- **THEN** o campo `icon` expõe a lista (enum) do catálogo de nomes válidos