## ADDED Requirements

### Requirement: Proposta de trabalho fundamentada no conteúdo lido

O sistema SHALL permitir ao agente transformar o conteúdo efetivamente lido de um anexo em uma proposta revisável — critérios de aceite, descrição e/ou checklist — na qual a **prévia de aprovação identifica o anexo de origem**. A aplicação da proposta SHALL reutilizar as ferramentas de mutação e o fluxo de aprovação vigentes, com preview, escopo, contagem e hash cobrindo os argumentos reais, e a proposta SHALL se limitar ao alvo solicitado.

#### Scenario: Propor critérios de aceite a partir de anexo textual

- **WHEN** o usuário pede para usar um documento anexado e propor critérios de aceite ou checklist
- **THEN** o agente lê o anexo, apresenta uma proposta baseada no texto extraído e a prévia de aprovação cita o anexo de origem antes de aplicar

#### Scenario: Aplicação somente após aprovação

- **WHEN** a proposta gera uma mutação
- **THEN** a mutação segue o fluxo de aprovação existente e só é executada após o aceite, usando exatamente o payload revisado

#### Scenario: Escopo restrito ao alvo

- **WHEN** o anexo de origem pertence a um card e a proposta altera itens ou checklists
- **THEN** as alterações se limitam ao alvo solicitado e aos itens citados, sem ampliar a população por re-filtro no servidor

### Requirement: Proibição de fabricar interpretação

O sistema SHALL NÃO apresentar como lido um anexo cujo formato não foi interpretado nem inventar critérios, checklists ou dados que não estejam fundamentados no conteúdo extraído. Quando a leitura retornar `unsupported` ou falha de decodificação, o agente SHALL declarar a limitação e NÃO SHALL produzir uma proposta como se tivesse interpretado o arquivo.

#### Scenario: Formato não suportado

- **WHEN** o anexo indicado é PDF, imagem ou outro formato não interpretável e a leitura retorna `unsupported`
- **THEN** o agente informa que não conseguiu interpretar o arquivo e não gera proposta a partir do conteúdo dele

#### Scenario: Nenhum dado inventado

- **WHEN** o conteúdo lido não contém informação suficiente para os critérios propostos
- **THEN** o agente pergunta ao usuário ou omite o campo, sem preencher valores plausíveis como se viessem do documento

#### Scenario: Referência ao arquivo é verificável

- **WHEN** a proposta cita o anexo de origem
- **THEN** a referência corresponde a um anexo que foi efetivamente lido na run, e não a um arquivo apenas listado ou inexistente
