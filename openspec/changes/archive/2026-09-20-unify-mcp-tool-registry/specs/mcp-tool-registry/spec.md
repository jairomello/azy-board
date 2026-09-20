## ADDED Requirements

### Requirement: Fonte única de verdade por ferramenta

O catálogo do MCP SHALL definir cada ferramenta em um único descritor que declara, no mesmo ponto, nome, descrição, campos aceitos (com tipo, obrigatoriedade, limites e texto de ajuda), routing e policy. Nenhuma outra estrutura do MCP SHALL manter listas paralelas de campos obrigatórios, campos por ferramenta, classificação de routing ou limites de texto que precisem ser editadas separadamente.

#### Scenario: Campo obrigatório declarado uma única vez

- **WHEN** um campo de uma ferramenta passa a ser obrigatório ou deixa de ser
- **THEN** a mudança é feita apenas no descritor da ferramenta e se reflete no schema exposto, na validação de argumentos e no catálogo interno sem edição adicional

#### Scenario: Inclusão de nova ferramenta

- **WHEN** uma ferramenta nova é adicionada ao catálogo
- **THEN** ela passa a aparecer na listagem, na validação e no routing a partir do próprio descritor, sem tabelas auxiliares a atualizar

#### Scenario: Ferramenta sem descritor falha explicitamente

- **WHEN** existe um executor de ferramenta sem descritor correspondente no catálogo
- **THEN** a verificação de contrato falha e aponta a ferramenta sem definição, em vez de aceitá-la silenciosamente

### Requirement: Schema e validação derivados

O schema exposto ao cliente MCP e ao modo estrito SHALL ser derivado do mesmo descritor usado pela validação de argumentos. O servidor NÃO SHALL manter uma tabela de campos obrigatórios em arquivo separado da definição do catálogo. Uma ferramenta sem obrigatórios e uma ferramenta com obrigatórios SHALL ser tratadas de forma consistente entre exposição e validação.

#### Scenario: Schema e validação concordam

- **WHEN** um cliente consulta a lista de ferramentas e depois envia argumentos
- **THEN** os campos exigidos na exposição são exatamente os exigidos pela validação de argumentos

#### Scenario: Campo opcional omitido é aceito

- **WHEN** um campo opcional é omitido ou enviado como null
- **THEN** a validação trata o valor como não informado e a chamada prossegue, sem exigir o campo

#### Scenario: Divergência entre schema e validação reprova o gate

- **WHEN** um teste de contrato detecta um campo obrigatório no schema que a validação não exige, ou o inverso
- **THEN** o teste falha antes do merge, impedindo a divergência

### Requirement: Routing e classificação derivados do descritor

A classificação de cada ferramenta — domínio, escopo, operação, risco, dependências e telas suportadas — SHALL ser declarada no descritor ou derivada deterministicamente dela. NÃO SHALL existir conjuntos manuais de nomes de ferramentas usados apenas para classificar routing em paralelo ao catálogo.

#### Scenario: Routing consultável por ferramenta

- **WHEN** o harness ou o roteamento de ferramentas precisa saber o domínio, escopo, operação e risco de uma ferramenta
- **THEN** obtém esses dados a partir da definição da ferramenta, sem consultar listas de nomes separadas

#### Scenario: Classificação consistente após renomear

- **WHEN** uma ferramenta é renomeada no descritor
- **THEN** sua classificação acompanha o novo nome sem exigir atualização de conjuntos manuais

### Requirement: Contrato do catálogo verificado no CI

O projeto SHALL manter verificações automatizadas que garantam que catálogo, schema, validação, routing e limites permanecem derivados da fonte única, e SHALL executá-las no pipeline de integração contínua.

#### Scenario: Catálogo sem código morto

- **WHEN** a verificação de catálogo roda
- **THEN** ela reprova se encontrar estruturas de definição duplicadas ou ramos inalcançáveis que possam divergir do descritor

#### Scenario: Ferramentas obrigatórias presentes

- **WHEN** a verificação de catálogo roda
- **THEN** ela confirma que todas as ferramentas expostas têm descritor, policy e executor, e que não há descritor sem executor
