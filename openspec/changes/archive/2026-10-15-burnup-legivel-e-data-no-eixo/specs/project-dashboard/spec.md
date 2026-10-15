# Spec Delta

## ADDED Requirements

### Requirement: Burnup sem evolução no período

Quando o período exibido não tiver nenhuma conclusão e o escopo não variar, o quadro de burnup SHALL apresentar uma mensagem explícita de ausência de evolução em vez do gráfico reto, mantendo as notas de cobertura aplicáveis. Havendo conclusão ou variação de escopo em qualquer ponto do período, o gráfico SHALL ser exibido normalmente.

#### Scenario: Período sem conclusão e com escopo constante

- **WHEN** o burnup é exibido em um projeto cuja série do período tem concluídos zero e escopo constante
- **THEN** o quadro informa que não houve conclusão no período e que o escopo se manteve, sem desenhar o gráfico reto

#### Scenario: Período com conclusão

- **WHEN** ao menos um dia do período registra itens concluídos
- **THEN** o gráfico do burnup é exibido normalmente

#### Scenario: Escopo variou sem conclusão

- **WHEN** o escopo muda dentro do período e nenhuma conclusão é registrada
- **THEN** o gráfico continua sendo exibido, porque a variação de escopo é informação do quadro

#### Scenario: Cobertura parcial permanece explicada

- **WHEN** o quadro apresenta a mensagem de ausência de evolução em um projeto com cobertura parcial
- **THEN** as notas de cobertura e a data de início da série continuam visíveis

### Requirement: Recorte de pontos do burnup segue a cobertura de estimativa

O recorte de pontos do burnup SHALL NOT ser oferecido quando a cobertura de estimativa da população for zero, seguindo a regra do dashboard para visões de pontos; o quadro SHALL orientar a estimar no lugar de apresentar uma série vazia.

#### Scenario: Projeto sem estimativas

- **WHEN** nenhum item da população tem pontos e o usuário abre o quadro de burnup
- **THEN** o recorte de pontos não é oferecido e o quadro orienta a definir estimativas

#### Scenario: Projeto com estimativas

- **WHEN** existe ao menos um item estimado na população
- **THEN** o recorte de pontos permanece disponível e alterna acessivelmente entre itens e pontos
