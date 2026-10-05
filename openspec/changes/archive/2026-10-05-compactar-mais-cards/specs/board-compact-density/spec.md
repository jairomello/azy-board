## MODIFIED Requirements

### Requirement: Compactação efetiva dos cards
No estado Compacta, o sistema SHALL compactar os cards para uma visualização mais densa: reduzir o espaçamento vertical interno (preenchimento e distância entre regiões), limitar o título a uma linha e ocultar o breadcrumb. O texto completo do título SHALL permanecer acessível por tooltip. O estado Compacta SHALL NOT remover as demais regiões do card (topo com alça/ícone/código, etiquetas, progresso de checklist e rodapé) nem os controles, e SHALL NOT alterar o estado Confortável.

#### Scenario: Cards visivelmente mais densos
- **WHEN** o Board está em Compacta
- **THEN** os cards exibem menos altura por card do que em Confortável, com o título em uma linha e o breadcrumb oculto, mantendo topo, etiquetas, progresso e rodapé visíveis

#### Scenario: Título completo acessível
- **WHEN** o título é truncado em uma linha no modo Compacta
- **THEN** o texto completo fica disponível por tooltip ao passar o mouse sobre o título, e a edição inline continua funcionando

#### Scenario: Confortável restaura o layout completo
- **WHEN** o usuário retorna de Compacta para Confortável
- **THEN** o breadcrumb volta a ser exibido e o título volta a ocupar até duas linhas

#### Scenario: Efeito perceptível em relação ao estado anterior
- **WHEN** o usuário alterna entre Confortável e Compacta com cards exibidos
- **THEN** a área de cards muda de densidade de forma perceptível na tela, sem perder informação além do breadcrumb e do truncamento do título
