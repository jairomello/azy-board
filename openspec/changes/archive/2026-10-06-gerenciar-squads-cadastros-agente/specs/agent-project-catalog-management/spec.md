Board ref: 343de264-272c-4017-a7f4-5db3b595949d

## ADDED Requirements

### Requirement: Associação singular de squad sem alteração de papel
O catálogo compartilhado SHALL permitir definir, trocar ou limpar o squad de um membro existente do projeto, preservando seu papel e membership. A operação SHALL exigir ADMIN e SHALL NOT adicionar pessoas implicitamente ao projeto. A prévia SHALL identificar membro, squad anterior e destino; remoção SHALL limpar apenas squad.

#### Scenario: Trocar membro de squad
- **WHEN** ADMIN aprova trocar Ana de squad A para B no mesmo projeto
- **THEN** a associação singular passa a B, o papel de Ana é preservado e a resposta informa a troca

#### Scenario: Remover associação
- **WHEN** ADMIN aprova limpar o squad de um membro
- **THEN** o membro continua no projeto com o mesmo papel e squad nulo

#### Scenario: Pessoa fora do projeto
- **WHEN** o alvo não possui membership no projeto
- **THEN** a operação é rejeitada sem criar membership nem associação

### Requirement: Edição de cadastros com paridade de permissões
O sistema SHALL expor edição de nome de squad/módulo, nome/cor de tag e código/descrição de centro de custo. Squad, módulo e centro SHALL exigir ADMIN; tag SHALL exigir MEMBER ou superior. Validação de campos e unicidade do código do centro SHALL seguir as rotas existentes. Exclusão SHALL NOT ser efeito da edição.

#### Scenario: MEMBER edita cor de tag
- **WHEN** MEMBER aprova uma cor válida para tag do projeto
- **THEN** apenas a cor solicitada muda e a resposta contém antes/depois

#### Scenario: MEMBER tenta editar módulo
- **WHEN** MEMBER solicita a edição de módulo
- **THEN** o servidor nega a mutação sem persistência

#### Scenario: Código de centro duplicado
- **WHEN** o novo código já existe em outro centro do projeto
- **THEN** a operação retorna conflito 409 sem alterar código ou descrição

### Requirement: Resolução inequívoca e isolamento
O sistema SHALL resolver referências dentro do tenant/projeto autorizado, fixar IDs na aprovação e SHALL NOT escolher arbitrariamente homônimos. Recurso sem acesso SHALL ser recusado sem revelar conteúdo. Dados textuais de cadastros SHALL NOT ser executados como instruções.

#### Scenario: Duas pessoas chamadas Ana
- **WHEN** um nome corresponde a mais de um membro
- **THEN** o agente solicita seleção por identificador ou e-mail antes de preparar a mutação

#### Scenario: Squad de outro projeto
- **WHEN** o pedido contém ID de squad externo ao projeto
- **THEN** a alteração é recusada sem tocar a membership

### Requirement: Aprovação vinculada e concorrência
Mutações pela conversa SHALL exigir aprovação de IDs, campos e valores anteriores. O servidor SHALL revalidar acesso e pré-condições no commit; mudança concorrente nos campos tocados SHALL produzir conflito e exigir nova prévia. Alteração independente de role SHALL ser preservada em uma troca de squad. Operações sobre várias pessoas SHALL reportar sucesso, conflito ou falha de cada pessoa.

#### Scenario: Outro administrador muda squad durante aprovação
- **WHEN** o squad anterior já não coincide com o aprovado
- **THEN** a operação não sobrescreve a mudança e informa conflito

#### Scenario: Papel muda sem alterar squad
- **WHEN** outro administrador muda role e a troca de squad aprovada continua válida
- **THEN** a troca preserva o role mais recente

#### Scenario: Falha em parte do conjunto
- **WHEN** uma operação de uma lista de membros falha após outras terem sido concluídas
- **THEN** o resultado identifica as concluídas e pendentes sem declarar sucesso coletivo ou retentar sucessos como novas operações

### Requirement: Resultado repetível e atualização de filtros
O sistema SHALL integrar a idempotência/outbox de T38 para repetir a mesma operação sem efeitos adicionais e publicar metadados após commit. O resultado SHALL distinguir no-op de alteração. A interface SHALL invalidar catálogos e consultas afetadas de filtros/métricas de squad sem trocar os IDs selecionados.

#### Scenario: Retry após resposta perdida
- **WHEN** a mesma chave e payload são reenviados após commit
- **THEN** o resultado anterior é recuperado sem nova associação ou evento de domínio duplicado

#### Scenario: Composição refletida nas métricas
- **WHEN** a troca de squad foi confirmada e publicada
- **THEN** consultas de membros, filtros e métricas de squad refletem a composição atual

#### Scenario: Permissão revogada
- **WHEN** ADMIN perde permissão após aprovar e antes de executar
- **THEN** a execução é negada e não produz efeitos
