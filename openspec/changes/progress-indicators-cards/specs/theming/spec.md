# Spec Delta

## ADDED Requirements

### Requirement: Indicadores de progresso derivam cores do tema
Barras de progresso SHALL derivar trilho, preenchimento, marcas e brilho dos tokens do tema ativo, incluindo os modos claro e escuro, sem cores fixas no componente. O preenchimento parcial SHALL usar a família de cor de avanço e o preenchimento completo SHALL usar o token de concluído. A troca de tema SHALL refletir nos indicadores sem recarregar a página e sem perder o valor exibido.

#### Scenario: Alternar tema com barras visíveis
- **WHEN** o usuário alterna entre claro e escuro com cards e projetos na tela
- **THEN** as barras atualizam suas cores imediatamente e continuam legíveis

#### Scenario: Preset claro selecionado
- **WHEN** o usuário escolhe um preset estrutural claro
- **THEN** as barras permanecem coerentes com o conteúdo e legíveis, sem depender das cores do shell

#### Scenario: Contraste do trilho e do preenchimento
- **WHEN** a barra está em 0%, parcial ou 100%
- **THEN** trilho e preenchimento são distinguíveis entre si e do fundo do card nos dois temas
