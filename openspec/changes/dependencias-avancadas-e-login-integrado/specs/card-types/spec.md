# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Quatro tipos de item: EPIC, STORY, TASK, BUG`
- TO: `### Requirement: Cinco tipos de item: EPIC, STORY, TASK, BUG, EXTERNAL`

## MODIFIED Requirements

### Requirement: Cinco tipos de item: EPIC, STORY, TASK, BUG, EXTERNAL
O sistema SHALL suportar cinco tipos de item discriminados pelo campo `type` na tabela `items`: `EPIC`, `STORY`, `TASK`, `BUG` e `EXTERNAL`. O tipo `STORY` deixa de existir como tipo de card de task avulso — todos os items são da tabela `items`.

#### Scenario: Badge de tipo visível no card
- **WHEN** um card é exibido no board
- **THEN** badge com o tipo (`Epic`, `Story`, `Task`, `Bug`, `Dep. Externa`) é exibido no rodapé do card

#### Scenario: Tipo padrão ao criar card pelo formulário rápido
- **WHEN** card é criado pelo botão "+" na coluna
- **THEN** o tipo padrão é `TASK`; o formulário expõe seletor de tipo com opções `Task` e `Bug`

#### Scenario: Seletor de tipo na modal de edição
- **WHEN** modal de edição de card TASK, BUG ou EXTERNAL é aberta
- **THEN** campo "Tipo" exibe select com opções `Task`, `Bug` e `Dep. Externa` (EPIC e STORY não são editáveis como tipo aqui)

#### Scenario: Cores diferenciadas por tipo
- **WHEN** badge de tipo é renderizado
- **THEN** `Epic` aparece em laranja/âmbar, `Story` em roxo/violeta, `Task` em azul neutro, `Bug` em vermelho e `Dep. Externa` em cinza ardósia

#### Scenario: Rótulos localizados do tipo dependência externa
- **WHEN** o tipo `EXTERNAL` é exibido em PT-BR ou EN
- **THEN** o rótulo é `Dep. Externa` em PT-BR e `Ext. Dependence` em EN

---

### Requirement: Persistência do tipo no banco
O sistema SHALL persistir o campo `type` como `TEXT NOT NULL` com enum `EPIC | STORY | TASK | BUG | EXTERNAL` e default `TASK` na tabela `items`. O CHECK de integridade SHALL aceitar `EXTERNAL` como valor válido tanto em SQLite quanto em PostgreSQL.

#### Scenario: Tipo persistido na criação
- **WHEN** item é criado via `POST /projects/:id/items` com `type` no body
- **THEN** banco registra o `type` informado; se ausente, usa `TASK` como default

#### Scenario: Tipo EXTERNAL persistido
- **WHEN** item é criado com `type = EXTERNAL`
- **THEN** o banco persiste e devolve o item com `type = EXTERNAL`, sem violar o CHECK de tipo

## ADDED Requirements

### Requirement: Tipo de item dependência externa (EXTERNAL)
O sistema SHALL tratar `EXTERNAL` como item folha com o mesmo formulário da task, representando trabalho de terceiros ou de outra equipe que destrava o projeto. Itens `EXTERNAL` SHALL ser cards móveis no Kanban como `TASK`/`BUG`, SHALL usar prefixo de código de sequência próprio e SHALL poder ser alvo e origem de dependências.

#### Scenario: Criar item de dependência externa
- **WHEN** um membro autorizado cria um item com `type = EXTERNAL` informando título e projeto
- **THEN** o sistema cria um card folha de dependência externa aplicando as mesmas regras de criação de trabalho dos cards (coluna, código de sequência, ícone padrão) e vinculando à sprint e versão ativas quando houver

#### Scenario: Item EXTERNAL aparece como card móvel
- **WHEN** um card de tipo `EXTERNAL` é exibido no board
- **THEN** ele pode ser movido entre colunas como um card `TASK`/`BUG`, respeitando a Leaf Rule

#### Scenario: EXTERNAL não aceita filhos
- **WHEN** um item de tipo `EXTERNAL` recebe um item filho direto
- **THEN** o sistema rejeita a operação por regra de hierarquia, pois `EXTERNAL` é folha

#### Scenario: EXTERNAL como alvo de dependência
- **WHEN** um item depende de um item de tipo `EXTERNAL`
- **THEN** o sistema aceita o vínculo e o item dependido aparece normalmente na aba Dependências e nos payloads do board e da árvore

#### Scenario: Código de sequência próprio
- **WHEN** um item `EXTERNAL` é criado
- **THEN** ele recebe um código de sequência com prefixo próprio do tipo, distinto de `E`, `S`, `T` e `B`
