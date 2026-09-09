## ADDED Requirements

### Requirement: Schemas progressivos sem perda de capability
O sistema SHALL enviar um conjunto inicial pequeno de schemas e SHALL carregar schemas adicionais sob demanda quando a intenção ou uma dependência exigir. Ausência inicial MUST NOT ser tratada como indisponibilidade funcional.

#### Scenario: Pedido local
- **WHEN** tools primárias do contexto resolvem o pedido
- **THEN** somente seus schemas e dependencies necessárias são enviados

#### Scenario: Pedido de outro domínio
- **WHEN** usuário solicita explicitamente capability autorizada de outro domínio
- **THEN** o schema é carregado dinamicamente sem enviar o catálogo completo

#### Scenario: Métrica por rodada
- **WHEN** o catálogo enviado muda
- **THEN** a run registra quantidade de tools, expansão e domínios carregados sem persistir prompt completo

### Requirement: Contexto compacto e não autoritativo
O contexto visual SHALL conter apenas sinais necessários para prioridade e defaults. Tela e filtros do cliente MUST NOT conceder acesso nem impedir capability autorizada.

#### Scenario: Tela manipulada
- **WHEN** cliente envia screen incompatível
- **THEN** o backend revalida recursos e policy e não concede capacidade adicional

#### Scenario: Título com palavra de capability
- **WHEN** dados não confiáveis contêm nomes de domínio ou tools
- **THEN** eles não alteram seleção, alvo ou expansão
