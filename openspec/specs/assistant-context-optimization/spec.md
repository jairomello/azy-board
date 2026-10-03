## Purpose

Definir a otimização de contexto, seleção de ferramentas e continuidade de aprovações do Azy Agent.
## Requirements
### Requirement: Contexto limitado e persistente
O sistema MUST enviar ao modelo o resumo e uma janela recente da conversa, preservando a mensagem atual e o estado pendente de confirmação dentro do limite configurado.

#### Scenario: Nova mensagem contextual
- GIVEN uma conversa com mensagens anteriores
- WHEN uma nova mensagem é processada
- THEN o modelo recebe o resumo e as mensagens recentes relevantes

### Requirement: Seleção de ferramentas
O sistema MUST enviar somente ferramentas compatíveis com a intenção detectada, mantendo fallback seguro e autorização server-side.

#### Scenario: Consulta simples
- WHEN o usuário pede uma consulta
- THEN ferramentas de leitura relacionadas são enviadas, sem ferramentas destrutivas

### Requirement: Continuação de aprovação
O sistema MUST executar uma aprovação válida uma única vez e continuar a run sem exigir que o modelo reinterprete a confirmação.

#### Scenario: Confirmação explícita
- GIVEN uma aprovação pendente não expirada
- WHEN o usuário confirma com o hash correto
- THEN a operação é executada uma vez e o resultado é continuado ao modelo

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
O contexto visual SHALL conter os sinais necessários para prioridade e defaults — incluindo, quando disponível, a fotografia versionada do contexto da tela (filtros com semântica de ausência e IDs dos cards apresentados), mantida compacta e sem a lista completa de conteúdo do projeto na janela. Tela, filtros e IDs do cliente MUST NOT conceder acesso, alterar o escopo aprobado nem impedir capability autorizada; o pré-escopo da mutação é resolvido e imposto pelo servidor.

#### Scenario: Tela manipulada
- **WHEN** cliente envia screen incompatível
- **THEN** o backend revalida recursos e policy e não concede capacidade adicional

#### Scenario: Título com palavra de capability
- **WHEN** dados não confiáveis contêm nomes de domínio ou tools
- **THEN** eles não alteram seleção, alvo ou expansão

#### Scenario: IDs da fotografia são referências a validar
- **WHEN** a fotografia carrega IDs de cards para escopar uma mutação
- **THEN** o servidor valida acesso/projeto/tenant de cada ID e rejeita IDs inválidos antes de executar

#### Scenario: Prévia reflete a população real
- **WHEN** a prévia de `update_items` é gerada com escopo capturado
- **THEN** ela exibe a quantidade do conjunto e as alterações por card, sem re-filtrar para além da fotografia

