## MODIFIED Requirements

### Requirement: Harness server-side de tool calls
O sistema SHALL executar o Azy Agent no backend por meio de um loop limitado que envia contexto/tools ao modelo, valida chamadas, executa tools internas e devolve resultados sanitizados até resposta final, pergunta, aprovação, erro ou limite. Esse contrato SHALL ser protegido por testes determinísticos dos fluxos recorrentes de criação e atualização do agente.

#### Scenario: Modelo solicita leitura
- **WHEN** o modelo retorna function call para uma leitura permitida
- **THEN** o harness valida schema e contexto, executa a leitura como o usuário solicitante e devolve resultado seguro ao modelo

#### Scenario: Modelo solicita tool inexistente
- **WHEN** o modelo retorna nome ou argumentos fora do registry
- **THEN** o harness rejeita a chamada sem fallback privilegiado, registra erro seguro e encerra ou pede nova orientação

#### Scenario: Fluxo recorrente é alterado
- **WHEN** uma mudança estrutural modifica uma entidade, schema ou tool usada pela suíte de regressão
- **THEN** `bun run check` executa os cenários do harness e falha caso criação, hierarquia, lote, filtros ou atribuição deixem de atender ao contrato
