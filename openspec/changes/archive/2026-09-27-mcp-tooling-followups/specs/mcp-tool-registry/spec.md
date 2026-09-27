## MODIFIED Requirements

### Requirement: Fonte única de verdade por ferramenta

O catálogo de ferramentas SHALL definir cada ferramenta em um único descritor que declara, no mesmo ponto, nome, descrição, campos aceitos (com tipo, obrigatoriedade, limites e texto de ajuda), routing, policy e forma da resposta. A fonte única SHALL viver em `packages/tool-registry` (`@azy-board/tool-registry`), acessível por API e MCP via nome de package. Nenhuma outra estrutura SHALL manter listas paralelas de campos obrigatórios, campos por ferramenta, classificação de routing, limites ou shape de resposta que precisem ser editadas separadamente.

#### Scenario: Campo obrigatório declarado uma única vez

- **WHEN** um campo de uma ferramenta passa a ser obrigatório ou deixa de ser
- **THEN** a mudança é feita apenas no descritor da ferramenta em `packages/tool-registry` e se reflete no schema exposto, na validação e no catálogo interno sem edição adicional

#### Scenario: Nova projeção declarada uma única vez

- **WHEN** `list_tasks` ganha um campo projetável ou uma relação achatada
- **THEN** tipo, limite, descrição, validação e resposta derivam do descritor compartilhado

#### Scenario: Inclusão de nova ferramenta

- **WHEN** uma ferramenta nova é adicionada ao catálogo
- **THEN** ela passa a aparecer na listagem, na validação e no routing a partir do próprio descritor no package, sem tabelas auxiliares a atualizar

#### Scenario: Ferramenta sem descritor falha explicitamente

- **WHEN** existe um executor de ferramenta sem descritor correspondente no catálogo
- **THEN** a verificação de contrato falha e aponta a ferramenta sem definição, em vez de aceitá-la silenciosamente

### Requirement: Schema e validação derivados

O schema exposto ao cliente MCP e ao modo estrito SHALL ser derivado do mesmo descritor usado pela validação de argumentos e pela forma de resposta. O servidor NÃO SHALL manter uma tabela de campos obrigatórios, projeções ou formas de resposta em arquivo separado da definição do catálogo. Uma ferramenta sem obrigatórios e uma ferramenta com obrigatórios SHALL ser tratadas de forma consistente entre exposição, validação e execução.

#### Scenario: Schema e validação concordam

- **WHEN** um cliente consulta a lista de ferramentas e depois envia argumentos
- **THEN** os campos exigidos na exposição são exatamente os exigidos pela validação de argumentos

#### Scenario: Campo opcional omitido é aceito

- **WHEN** um campo opcional é omitido ou enviado como null
- **THEN** a validação trata o valor como não informado e a chamada prossegue, sem exigir o campo

#### Scenario: Resposta declarada coincide com executor

- **WHEN** um agente invoca `update_items` ou `list_tasks`
- **THEN** os campos de resposta publicados pelo catálogo correspondem à forma produzida pelo executor

#### Scenario: Divergência entre schema e validação reprova o gate

- **WHEN** um teste de contrato detecta divergência de campo, projeção, nullable, resposta ou obrigatoriedade
- **THEN** o teste falha antes do merge, impedindo a divergência

### Requirement: Contrato do catálogo verificado no CI

O projeto SHALL manter verificações automatizadas que garantam que catálogo, schema, validação, routing, limites, projeções e respostas permanecem derivados da fonte única em `packages/tool-registry`, e SHALL executá-las no pipeline de integração contínua. Os testes de contrato (`registry-contract`, `optional-fields`) SHALL cobrir shapes de resposta, orçamento de payload e novos fluxos de checklist.

#### Scenario: Catálogo sem código morto

- **WHEN** a verificação de catálogo roda
- **THEN** ela reprova se encontrar estruturas de definição duplicadas ou ramos inalcançáveis que possam divergir do descritor

#### Scenario: Ferramentas obrigatórias presentes

- **WHEN** a verificação de catálogo roda
- **THEN** ela confirma que todas as ferramentas expostas têm descritor, policy e executor, e que não há descritor sem executor

#### Scenario: Orçamento de payload protegido

- **WHEN** o teste de catálogo mede uma resposta padrão de `list_tasks`
- **THEN** reprova se descrições completas ou relações aninhadas excederem o orçamento definido para a resposta leve

#### Scenario: Testes de contrato no package

- **WHEN** `bun test packages/tool-registry` roda
- **THEN** os testes de unicidade, consistência, projeção, resposta e shapes de checklist passam
