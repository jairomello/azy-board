# Spec Delta

## MODIFIED Requirements

### Requirement: Cadastro de dependências entre itens

O sistema SHALL permitir que usuários autorizados associem múltiplas dependências a um item do board. Cada dependência SHALL referenciar o item de origem (`itemId`), o item do qual ele depende (`dependsOnItemId`), um tipo de dependência e um retardo. Origem e alvo SHALL pertencer ao mesmo tenant. O alvo SHALL ser qualquer item existente de um projeto acessível ao usuário, independentemente do tipo (TASK, BUG, EXTERNAL, STORY ou EPIC), incluindo itens de outro projeto quando as regras de dependências cross-project forem aplicadas.

#### Scenario: Criar dependência entre dois itens
- **WHEN** um membro autorizado envia o item dependido e o tipo para um item de origem acessível no mesmo projeto
- **THEN** o sistema persiste a dependência associada ao tenant, projeto e item de origem e retorna seus dados

#### Scenario: Item de origem igual ao dependido
- **WHEN** o usuário tenta criar uma dependência em que o item de origem e o item dependido são o mesmo
- **THEN** o sistema rejeita a operação com erro de validação acionável e não persiste o vínculo

#### Scenario: Alvo inexistente, de outro projeto ou de outro tenant
- **WHEN** o usuário informa um `dependsOnItemId` que não existe, pertence a um projeto inacessível ao usuário ou a outro tenant
- **THEN** o sistema rejeita a operação sem revelar dados de outros tenants e não persiste o vínculo

#### Scenario: Listar dependências do item
- **WHEN** um usuário com acesso de leitura consulta as dependências de um item
- **THEN** o sistema retorna somente as dependências associadas àquele item no tenant e projeto autorizados, com os dados necessários para exibir o item dependido

## ADDED Requirements

### Requirement: Alvo de dependência no tipo dependência externa
O sistema SHALL aceitar itens de tipo `EXTERNAL` como alvo e como origem de dependências, tratando-os como nós legítimos do grafo, com os mesmos tipos FS/SS/SF/FF e retardo. A validação de ciclos, a exclusão em cascata e a exposição de `dependencies`/`dependencyCount` SHALL incluir itens `EXTERNAL`.

#### Scenario: Depender de uma dependência externa
- **WHEN** um item do projeto recebe uma dependência cujo alvo é um item de tipo `EXTERNAL`
- **THEN** o sistema persiste o vínculo e exibe o alvo como qualquer outro item dependido

#### Scenario: Excluir dependência externa alvo
- **WHEN** um item `EXTERNAL` usado como alvo de dependências é excluído
- **THEN** as dependências que apontavam para ele são removidas e nenhum vínculo órfão permanece

#### Scenario: Ciclo passando por dependência externa
- **WHEN** uma nova dependência fecharia um ciclo que passa por um item `EXTERNAL`
- **THEN** o sistema rejeita a operação e mantém o grafo acíclico

### Requirement: Dependências entre projetos (cross-project)
O sistema SHALL permitir que o alvo de uma dependência pertença a outro projeto acessível ao usuário, dentro do mesmo tenant. O formulário SHALL permitir escolher o projeto do alvo e a lista de itens SHALL refletir o projeto escolhido, respeitando projetos restritos e ocultos. O sistema SHALL NOT revelar itens de projetos inacessíveis e SHALL NOT permitir cruzamento entre tenants. A origem da dependência permanece no projeto corrente.

#### Scenario: Criar dependência cross-project
- **WHEN** um membro autorizado escolhe um projeto acessível e um item desse projeto como alvo de uma dependência
- **THEN** o sistema persiste a dependência identificando o projeto e o item do alvo

#### Scenario: Projeto alvo inacessível rejeitado
- **WHEN** o usuário indica um alvo em projeto restrito, oculto ou sem acesso
- **THEN** o sistema rejeita a operação sem revelar a existência do item

#### Scenario: Tenant diferente rejeitado
- **WHEN** o alvo indicado pertence a outro tenant
- **THEN** o sistema rejeita a operação sem persistir o vínculo

#### Scenario: Listagem de dependência cross-project
- **WHEN** um item depende de um item de outro projeto acessível
- **THEN** a listagem do item dependido inclui a identificação do projeto do alvo

### Requirement: Replanejamento automático de datas
O sistema SHALL oferecer uma ação explícita de recálculo que propaga as datas de início e fim pelos itens não concluídos do projeto, conforme o tipo de dependência (FS/SS/SF/FF) e o retardo, no estilo MS Project. O recálculo SHALL NOT rodar automaticamente a cada edição de dependência; itens concluídos SHALL manter suas datas; e o usuário SHALL receber um resumo de quantos itens foram alterados.

#### Scenario: Recalcular propaga Término-Início
- **WHEN** o usuário aciona o recálculo em um projeto com dependências FS e datas definidas
- **THEN** o início do item sucessor é ajustado para o fim do predecessor acrescido do retardo

#### Scenario: Retardo negativo antecipa a data
- **WHEN** uma dependência possui `lagDays` negativo
- **THEN** o recálculo antecipa a data sucessora na quantidade de dias do retardo

#### Scenario: Itens concluídos preservados
- **WHEN** o recálculo é executado e existem itens concluídos no grafo
- **THEN** as datas dos itens concluídos não são alteradas

#### Scenario: Projeto sem dependências
- **WHEN** o usuário aciona o recálculo em um projeto sem dependências cadastradas
- **THEN** o sistema informa que não há nada a recalcular e não altera datas

#### Scenario: Resumo do recálculo
- **WHEN** o recálculo conclui
- **THEN** o sistema informa ao usuário quantos itens tiveram datas ajustadas

### Requirement: Cálculo de caminho crítico
O sistema SHALL calcular o caminho crítico do grafo de dependências do projeto considerando datas e durações, sinalizando os itens que determinam a duração total do cronograma. A exibição dos itens críticos SHALL ser opcional, controlada por um toggle que só fica disponível quando existirem dependências cadastradas.

#### Scenario: Destacar itens do caminho crítico
- **WHEN** o toggle de caminho crítico está ligado e existem dependências
- **THEN** os itens que compõem o caminho crítico são destacados visualmente no board

#### Scenario: Toggle indisponível sem dependências
- **WHEN** o projeto não possui dependências cadastradas
- **THEN** o toggle de caminho crítico não é oferecido

#### Scenario: Retardo influencia o caminho crítico
- **WHEN** uma dependência possui retardo
- **THEN** o cálculo do caminho crítico considera o retardo ao determinar a maior cadeia

### Requirement: Ferramentas MCP e Azy Agent para dependências
O sistema SHALL expor as operações de dependência como ferramentas do catálogo compartilhado (`list_item_dependencies`, `create_item_dependency`, `update_item_dependency`, `delete_item_dependency`), com política de leitura para `VIEWER`, escrita para `MEMBER` e dispatch para a API seguindo o padrão de `create_item_link`.

#### Scenario: Ferramentas expostas no catálogo
- **WHEN** o catálogo compartilhado é carregado
- **THEN** as quatro ferramentas de dependência aparecem com schema, policy e routing declarados no mesmo descritor

#### Scenario: Payloads de item continuam expondo o grafo
- **WHEN** um item com dependências é lido por `list_tasks`, `get_board` ou `get_tree`
- **THEN** o payload continua entregando `dependencies` e `dependencyCount`

#### Scenario: Escrita exige MEMBER
- **WHEN** uma credencial `VIEWER` tenta criar, editar ou remover uma dependência por ferramenta
- **THEN** o sistema rejeita a operação sem alterar dados

#### Scenario: Operações mapeiam para a API
- **WHEN** um agente chama as ferramentas de dependência
- **THEN** elas são traduzidas para os endpoints de dependências da API com o resultado devolvido ao agente

#### Scenario: Documentação e gates em dia
- **WHEN** os gates de catálogo e de skill são executados
- **THEN** as novas ferramentas estão documentadas e passam em `test:mcp-catalog` e `test:agent-skill`
