# documentation-integrity Specification

## Purpose

Definir os papéis de cada fonte de documentação, a geração de referências voláteis a partir do runtime (catálogo MCP, OpenAPI e limites), a fonte única das constantes de limites, a verificação de integridade (artefatos em dia, links internos e afirmações proibidas) e a revisão de documentação na definição de pronto.

## Requirements

### Requirement: Papéis definidos por fonte de documentação
O projeto SHALL definir, em um único índice de documentação, o papel de cada fonte e o que pertence a cada uma: código/schema/runtime como fonte dos contratos, OpenSpec para decisão e comportamento, wiki para uso do produto, README para arquitetura e início rápido, e CHANGELOG para histórico. Nenhum documento SHALL ser usado para replicar fatos que tenham fonte derivável no runtime.

#### Scenario: Índice define os papéis
- **WHEN** um autor consulta o índice de documentação
- **THEN** encontra o papel de cada fonte e a orientação de onde cada tipo de fato deve ser registrado

#### Scenario: Fato volátil não é replicado em prosa
- **WHEN** um documento descreve um contrato volátil (catálogo de ferramentas, rotas ou limites)
- **THEN** ele referencia o artefato derivado do runtime em vez de repetir os valores manualmente

### Requirement: Referências voláteis geradas a partir do runtime
O projeto SHALL gerar a partir do runtime, por comando único, o catálogo de ferramentas MCP (do registry), o documento OpenAPI (dos schemas de validação) e as tabelas de limites do Azy Agent (das constantes compartilhadas). Cada artefato gerado SHALL conter um cabeçalho informando que é gerado automaticamente e o comando para regenerá-lo, e SHALL NOT ser editado manualmente.

#### Scenario: Geração por comando único
- **WHEN** o desenvolvedor executa o comando de geração de documentação
- **THEN** o catálogo MCP, o OpenAPI e as tabelas de limites são escritos com o cabeçalho de origem

#### Scenario: Catálogo reflete o registry
- **WHEN** uma ferramenta MCP é adicionada, removida ou tem seu schema alterado
- **THEN** a regeneração atualiza o catálogo a partir do registry, sem edição manual

#### Scenario: OpenAPI reflete os schemas
- **WHEN** um schema de validação de request ou response muda
- **THEN** o documento OpenAPI gerado reflete a mudança

### Requirement: Fonte única das constantes de limites
Os limites do Azy Agent e do harness SHALL ser definidos em um único módulo compartilhado, consumido pela API, pelo frontend e pela geração de documentação. Nenhum consumidor SHALL manter uma cópia própria dos valores default ou das faixas válidas.

#### Scenario: API consome o módulo único
- **WHEN** a API resolve os limites de governança de um tenant
- **THEN** ela usa as constantes do módulo compartilhado, sem valores locais duplicados

#### Scenario: Frontend consome o módulo único
- **WHEN** o formulário de governança do Root é renderizado
- **THEN** seus valores default e faixas vêm do módulo compartilhado

#### Scenario: Extração preserva o comportamento
- **WHEN** as constantes são extraídas para o módulo compartilhado
- **THEN** os valores efetivos de runtime permanecem os mesmos e são cobertos por testes

### Requirement: Verificação de integridade da documentação
O projeto SHALL manter uma verificação que falhe quando: um artefato gerado divergir do runtime; um link interno relativo de Markdown apontar para um alvo inexistente; ou um documento contiver uma afirmação proibida da lista mantida em um ponto único. A verificação SHALL ser executável por comando único e integrar o fluxo de validação.

#### Scenario: Artefato gerado desatualizado reprova
- **WHEN** o runtime muda e o artefato gerado versionado não é regenerado
- **THEN** a verificação falha indicando o artefato divergente

#### Scenario: Link interno quebrado reprova
- **WHEN** um documento referencia um arquivo relativo inexistente
- **THEN** a verificação falha indicando o link quebrado

#### Scenario: Afirmação proibida reprova
- **WHEN** um documento volta a afirmar um fato sabidamente incorreto (por exemplo, que toda mutação exige aprovação ou que há importação de CSV ligada à interface)
- **THEN** a verificação falha indicando o trecho e o arquivo

#### Scenario: Documentação íntegra passa
- **WHEN** os artefatos gerados estão em dia, os links internos resolvem e não há afirmações proibidas
- **THEN** a verificação conclui com sucesso

### Requirement: Revisão de documentação na definição de pronto
O projeto SHALL incluir a revisão de documentação na definição de pronto, exigindo que contratos voláteis sejam regenerados e que a verificação de integridade esteja verde antes do merge.

#### Scenario: Checklist de PR inclui documentação
- **WHEN** um autor abre um pull request
- **THEN** o checklist exige a atualização dos contratos voláteis via geradores e a verificação de integridade verde

#### Scenario: Contrato volátil alterado sem regeneração é bloqueado
- **WHEN** uma mudança altera um contrato volátil sem regenerar os artefatos
- **THEN** a verificação de integridade falha e o pull request não é considerado pronto
