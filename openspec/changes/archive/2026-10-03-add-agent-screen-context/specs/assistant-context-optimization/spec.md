## MODIFIED Requirements

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
