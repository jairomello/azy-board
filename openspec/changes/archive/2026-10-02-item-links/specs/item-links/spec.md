## ADDED Requirements

### Requirement: Links externos vinculados a itens
O sistema SHALL permitir que usuários autorizados associem múltiplos links externos a um item do board. Cada link SHALL conter nome e URL obrigatórios e descrição opcional em Markdown canônico. A funcionalidade SHALL estar disponível independentemente da configuração de anexos do tenant.

#### Scenario: Criar link para um item
- **WHEN** um membro autorizado envia nome, URL HTTP/HTTPS válida e, opcionalmente, descrição para um item acessível
- **THEN** o sistema persiste o link associado ao tenant, projeto e item e retorna seus dados

#### Scenario: Validar campos do link
- **WHEN** o usuário envia nome vazio, URL inválida ou esquema diferente de HTTP/HTTPS, ou valores acima dos limites definidos pela API
- **THEN** o sistema rejeita a operação com erro de validação acionável e não persiste o link

#### Scenario: Listar links do item
- **WHEN** um usuário com acesso de leitura consulta os links de um item
- **THEN** o sistema retorna somente os links associados àquele item no tenant e projeto autorizados

#### Scenario: Links permanecem disponíveis com anexos desabilitados
- **WHEN** anexos estão desabilitados para o tenant e um usuário autorizado consulta ou cadastra um link
- **THEN** as operações de links continuam disponíveis e não dependem da configuração de anexos

### Requirement: Editar e remover links
O sistema SHALL permitir a usuários com permissão de escrita editar nome, URL e descrição de um link e remover individualmente um link do item. Campos omitidos em edição parcial SHALL permanecer inalterados.

#### Scenario: Editar link existente
- **WHEN** um membro autorizado atualiza um ou mais campos válidos de um link associado ao item
- **THEN** o sistema persiste somente os campos enviados e retorna o link atualizado

#### Scenario: Remover link existente
- **WHEN** um membro autorizado remove um link do item
- **THEN** o sistema exclui o link e ele deixa de aparecer na listagem daquele item

#### Scenario: Usuário sem permissão de escrita tenta alterar link
- **WHEN** um usuário com acesso somente de leitura tenta criar, editar ou remover um link
- **THEN** o sistema rejeita a operação sem modificar os dados

#### Scenario: Impedir acesso cruzado
- **WHEN** um usuário tenta consultar ou alterar link associado a outro tenant, projeto ou item não autorizado
- **THEN** o sistema não revela dados do link e rejeita a operação

### Requirement: Apresentação de links na interface do item
A interface SHALL apresentar a lista de links externos no contexto do item, mostrando nome e descrição quando disponíveis. Usuários com permissão de escrita SHALL poder criar, editar e remover links pela interface. Cada URL SHALL abrir em nova guia com proteção para impedir acesso da página externa à janela de origem.

#### Scenario: Abrir link externo
- **WHEN** o usuário ativa um link listado no item
- **THEN** o endereço é aberto em nova guia usando proteção equivalente a `noopener` e `noreferrer`

#### Scenario: Consultar links sem permissão de escrita
- **WHEN** um usuário com acesso somente de leitura abre a área de links do item
- **THEN** ele pode consultar e abrir os links, sem controles de criação, edição ou remoção

#### Scenario: Item sem links
- **WHEN** o item não possui links vinculados
- **THEN** a interface apresenta estado vazio e, para usuário autorizado, uma ação para adicionar o primeiro link
