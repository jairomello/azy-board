Board ref: 25667747-2b18-43b6-badc-a2e461527c44

## ADDED Requirements

### Requirement: Scanner de texto de produto independente de acento
O check i18n SHALL identificar texto fixo de produto em JSX, atributos acessíveis/visíveis, expressões de UI, toasts e validações, inclusive strings sem acento. SHALL reportar arquivo/posição/tipo e falhar quando não houver tradução ou exceção explícita estreita com justificativa. SHALL preservar conteúdo do usuário, URLs e identificadores técnicos sem traduzi-los.

#### Scenario: Literal ASCII visível
- **WHEN** componente contém texto fixo `Save`, `OK` ou placeholder `Nome` sem tradução e sem exceção justificada
- **THEN** checker falha indicando a ocorrência mesmo sem caractere acentuado

#### Scenario: Toast ou atributo em expressão
- **WHEN** mensagem fixa de toast, validação ou aria-label está numa expressão de código de produto
- **THEN** o scanner a identifica sem depender apenas de regex de JSXText

#### Scenario: Conteúdo externo e exceção
- **WHEN** um título fornecido pelo usuário ou identificador técnico permitido é renderizado
- **THEN** não é tratado como texto a traduzir e exceções de produto precisam motivo específico auditável

### Requirement: Resolução verificável de chaves de tradução
O checker SHALL validar chaves estáticas considerando namespace, aliases de `t`, keyPrefix, `Trans`, interpolação e pluralização contra PT-BR/EN/ES. Chaves dinâmicas SHALL declarar conjunto finito verificável ou manifesto; expressões opacas sem declaração SHALL falhar com diagnóstico acionável. A paridade estrutural existente SHALL permanecer obrigatória.

#### Scenario: Chave inexistente com alias
- **WHEN** função de tradução com alias e namespace conhecido referencia chave ausente
- **THEN** o checker falha com namespace/chave/posição em vez de aceitar fallback silencioso como cobertura

#### Scenario: Chave dinâmica declarada
- **WHEN** uma chave é construída a partir de conjunto finito declarado
- **THEN** todas as combinações de chave são validadas nos três idiomas e qualquer ausência reprova

#### Scenario: Expressão dinâmica opaca
- **WHEN** uma tradução usa expressão cujo conjunto não pode ser determinado e não há declaração validável
- **THEN** o checker exige declaração ou exceção justificada em vez de ignorar a ocorrência
