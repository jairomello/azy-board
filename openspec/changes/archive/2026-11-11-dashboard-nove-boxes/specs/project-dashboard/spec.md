# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: Dez boxes priorizados`
- TO: `### Requirement: Nove boxes priorizados`

## MODIFIED Requirements

### Requirement: Nove boxes priorizados
O sistema SHALL exibir exatamente os grupos Progresso e Escopo, WIP, Bloqueados, Atrasados, Burnup, Aging WIP, Tokens de IA, Carga da Equipe e Horas Registradas. Sprint e Versões SHALL NOT ser renderizados como quadros; eles permanecem disponíveis apenas como filtros quando aplicáveis. O sistema SHALL NOT exibir finanças, ações prioritárias, avaliação qualitativa ou recomendação por IA.

#### Scenario: Renderizar visão geral
- **WHEN** Dashboard possui dados disponíveis
- **THEN** os nove boxes são apresentados conforme aplicabilidade e cobertura

#### Scenario: Dados insuficientes
- **WHEN** box histórico não possui cobertura suficiente
- **THEN** sistema mostra estado parcial/indisponível e não fabrica o valor

## REMOVED Requirements

### Requirement: Sprint por ciclo
**Reason**: O Dashboard não renderiza box de Sprint; o compromisso por ciclo não é entregue pela página nem por endpoint próprio. Sprint permanece apenas como filtro.
**Migration**: Usar o requisito "Filtros com aplicabilidade explícita" para o recorte por sprint. Nenhum dado ou tela adicional é necessário.
