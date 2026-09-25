## MODIFIED Requirements

### Requirement: Fonte única de verdade por ferramenta

O catálogo de ferramentas SHALL definir cada ferramenta em um único descritor que declara, no mesmo ponto, nome, descrição, campos aceitos (com tipo, obrigatoriedade, limites e texto de ajuda), routing e policy. A fonte única SHALL viver em `packages/tool-registry` (`@azy-board/tool-registry`), acessível por API e MCP via nome de package. Nenhuma outra estrutura SHALL manter listas paralelas de campos obrigatórios, campos por ferramenta, classificação de routing ou limites de texto que precisem ser editadas separadamente.

#### Scenario: Campo obrigatório declarado uma única vez

- **WHEN** um campo de uma ferramenta passa a ser obrigatório ou deixa de ser
- **THEN** a mudança é feita apenas no descritor da ferramenta em `packages/tool-registry` e se reflete no schema exposto, na validação de argumentos e no catálogo interno sem edição adicional

#### Scenario: Inclusão de nova ferramenta

- **WHEN** uma ferramenta nova é adicionada ao catálogo
- **THEN** ela passa a aparecer na listagem, na validação e no routing a partir do próprio descritor no package, sem tabelas auxiliares a atualizar

#### Scenario: Ferramenta sem descritor falha explicitamente

- **WHEN** existe um executor de ferramenta sem descritor correspondente no catálogo
- **THEN** a verificação de contrato falha e aponta a ferramenta sem definição, em vez de aceitá-la silenciosamente

### Requirement: Contrato do catálogo verificado no CI

O projeto SHALL manter verificações automatizadas que garantam que catálogo, schema, validação, routing e limites permanecem derivados da fonte única em `packages/tool-registry`, e SHALL executá-las no pipeline de integração contínua. Os testes de contrato (`registry-contract`, `optional-fields`) SHALL viver junto do registry no package.

#### Scenario: Catálogo sem código morto

- **WHEN** a verificação de catálogo roda
- **THEN** ela reprova se encontrar estruturas de definição duplicadas ou ramos inalcançáveis que possam divergir do descritor

#### Scenario: Ferramentas obrigatórias presentes

- **WHEN** a verificação de catálogo roda
- **THEN** ela confirma que todas as ferramentas expostas têm descritor, policy e executor, e que não há descritor sem executor

#### Scenario: Testes de contrato no package

- **WHEN** `bun test packages/tool-registry` roda
- **THEN** os testes de unicidade e consistência do catálogo passam
