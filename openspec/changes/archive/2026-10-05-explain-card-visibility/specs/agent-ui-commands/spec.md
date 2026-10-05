## MODIFIED Requirements

### Requirement: Comandos tipados de interface

O sistema SHALL definir um contrato versionado de comandos de interface emitidos pela conversa, cobrindo: aplicar/substituir filtros, limpar filtros, definir o modo de visualização (Kanban ou árvore) e o módulo ativo, abrir um item, **revelar um item escondido** e voltar à visão anterior. Cada comando SHALL carregar um identificador único, o tipo e o alvo, e SHALL produzir um resultado de sucesso ou erro sem mutar dados. IDs e filtros recebidos da tela SHALL ser tratados como referências a validar, nunca como permissões.

#### Scenario: Comando de filtro tipado

- **WHEN** o agente emite um comando para aplicar filtros (ex.: tipo = Bug e versão sem valor)
- **THEN** o comando é expresso como estrutura tipada, com ausência de valor por operador e não pelo sentinela da interface como nome de entidade

#### Scenario: Comando inválido não altera a tela

- **WHEN** o comando referencia projeto sem acesso, item inexistente ou operação desconhecida
- **THEN** o comando é recusado com resultado de erro acionável e a visualização permanece inalterada

#### Scenario: Comando de revelação de item

- **WHEN** o agente emite um comando para revelar um item escondido
- **THEN** o comando carrega o alvo validado, é aplicado na aba de origem com checkpoint e não muta dados

## ADDED Requirements

### Requirement: Explicação somente-leitura de visibilidade

As ferramentas de explicação de visibilidade SHALL ser declaradas no catálogo do assistente como operações somente-leitura do domínio de UI, dispensando aprovação por não mutarem dados, e SHALL NOT ser expostas no catálogo MCP de agentes. A explicação SHALL validar o acesso ao projeto/item antes de responder e SHALL NOT revelar conteúdo sem permissão.

#### Scenario: Explicação não exige aprovação

- **WHEN** o modelo emite uma explicação de visibilidade
- **THEN** o harness a entrega sem pedir aprovação, pois não há mutação de dados

#### Scenario: Explicação ausente do catálogo MCP

- **WHEN** um agente autenticado por API Key consulta o catálogo MCP
- **THEN** as ferramentas de explicação de visibilidade não aparecem entre as ferramentas disponíveis

#### Scenario: Explicação respeita o acesso

- **WHEN** a explicação é pedida para item de projeto sem vínculo de acesso
- **THEN** a resposta recusa sem revelar o conteúdo do item
