## ADDED Requirements

### Requirement: Metadados opcionais de anexos

Cada anexo SHALL suportar três metadados opcionais: `label` (nome amigável de exibição, até 200 caracteres), `referenceDate` (data de referência do documento em formato ISO `YYYY-MM-DD`) e `description` (descrição em rich text armazenada em Markdown canônico, até 20000 caracteres). Nenhum dos três SHALL ser obrigatório para gravar o anexo.

#### Scenario: Upload sem metadados explícitos aplica sugestões automáticas

- **WHEN** o usuário envia um arquivo sem informar label, data ou descrição
- **THEN** o sistema grava o anexo com `label` igual ao nome original do arquivo, `referenceDate` igual à data do upload e `description` vazia

#### Scenario: Upload com metadados explícitos

- **WHEN** o cliente envia o multipart com `label`, `referenceDate` e/ou `description`
- **THEN** o sistema grava os valores informados em vez dos defaults

#### Scenario: Usuário mantém sugestões automáticas

- **WHEN** o usuário abre o formulário de metadados e salva sem alterar os valores sugeridos
- **THEN** o sistema grava os metadados com os valores sugeridos sem exigir preenchimento adicional

#### Scenario: Listagem expõe os metadados

- **WHEN** o cliente lista os anexos de um card
- **THEN** cada anexo retornado inclui `label`, `referenceDate`, `description` e `originalName`, além dos campos já existentes

### Requirement: Edição de metadados do anexo

O sistema SHALL disponibilizar edição parcial dos metadados de um anexo via `PATCH` no escopo do card, exigindo papel mínimo MEMBER no projeto, anexos habilitados no tenant e respeito ao isolamento tenant/projeto/item. Campos ausentes no corpo da requisição não SHALL ser alterados; `null` SHALL limpar o campo.

#### Scenario: Editar nome, data e descrição

- **WHEN** um usuário com papel MEMBER envia PATCH com novos valores de `label`, `referenceDate` e `description`
- **THEN** o sistema atualiza os campos informados, retorna o anexo atualizado e notifica os clientes conectados

#### Scenario: Limpar um metadado

- **WHEN** o usuário envia `label: null` no PATCH
- **THEN** o sistema grava `label` nulo e a interface passa a exibir o nome original do arquivo como fallback visual

#### Scenario: Validação de campos

- **WHEN** o PATCH envia `label` com mais de 200 caracteres, `referenceDate` em formato inválido ou `description` acima de 20000 caracteres
- **THEN** o sistema rejeita com erro de validação acionável e nenhuma alteração é persistida

#### Scenario: Usuário sem permissão de escrita

- **WHEN** um usuário com papel VIEWER tenta editar metadados de um anexo
- **THEN** o sistema retorna 403 sem alterar dados

#### Scenario: Anexos desabilitados no tenant bloqueiam edição

- **WHEN** o administrador desabilitou anexos no tenant e um usuário tenta editar metadados
- **THEN** o sistema retorna erro de conflito (409) e a leitura dos anexos e metadados existentes continua permitida

#### Scenario: Acesso cruzado é bloqueado

- **WHEN** um usuário de outro tenant ou não membro do projeto tenta editar metadados de um anexo
- **THEN** o sistema retorna 403/404 sem revelar a existência do anexo

### Requirement: Compatibilidade e backfill de anexos existentes

Os novos metadados SHALL ser opcionais nos contratos de API e tipos compartilhados, mantendo compatibilidade com clientes que não os conhecem. Anexos criados antes da funcionalidade SHALL receber `label` igual ao `original_name` no backfill da migração, com `referenceDate` e `description` nulos.

#### Scenario: Anexo legado após migração

- **WHEN** a migração é aplicada sobre anexos existentes
- **THEN** cada anexo legado passa a ter `label` igual ao nome original gravado, sem alteração dos demais dados

#### Scenario: Cliente antigo continua funcionando

- **WHEN** um cliente que não envia nem lê os novos campos faz upload e listagem de anexos
- **THEN** as operações continuam funcionando com o comportamento anterior e os campos novos são ignorados ou retornados como opcionais
