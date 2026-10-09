# Spec Delta

## MODIFIED Requirements

### Requirement: Temas estruturais do modo claro
O sistema SHALL permitir que o usuário escolha um preset de cor para sidebar e header no modo claro, independentemente da preferência claro/escuro.

Os presets suportados SHALL ser `petroleum`, `ocean`, `emerald`, `graphite`, `classic`, `ruby`, `amber`, `amethyst`, `rose` e `silver`, com `petroleum` como fallback e valor padrão.

A grade de seleção de presets SHALL exibir os dez presets com rótulo traduzido e amostra de cor coerente. Cada preset SHALL definir sidebar, header, borda, texto, item ativo, acento e texto sobre acento para o modo claro, mantendo contraste legível nos controles do shell.

#### Scenario: Selecionar tema Petróleo
- **WHEN** o usuário seleciona Petróleo nas preferências de aparência
- **THEN** sidebar e header recebem os tokens do preset `petroleum` imediatamente
- **AND** o conteúdo do Board permanece no esquema claro

#### Scenario: Selecionar outro preset claro
- **WHEN** o usuário seleciona Oceano, Esmeralda, Grafite ou Clássico
- **THEN** o shell é atualizado sem reload
- **AND** textos, ícones, foco e item ativo mantêm contraste WCAG AA

#### Scenario: Selecionar um dos novos presets
- **WHEN** o usuário seleciona Vermelho, Laranja, Roxo, Rosa ou Prata
- **THEN** o shell é atualizado sem reload para os tokens do preset escolhido
- **AND** o preset permanece legível e distinguível dos demais na grade

#### Scenario: Alternar para modo escuro e retornar
- **WHEN** o usuário possui um preset claro selecionado, alterna para o modo escuro e depois retorna ao claro
- **THEN** o modo escuro ignora os tokens do preset claro
- **AND** o preset claro anteriormente escolhido é restaurado

#### Scenario: Valor inválido ou desconhecido
- **WHEN** o valor vindo do banco ou `localStorage` não corresponde a um preset suportado
- **THEN** o sistema aplica `petroleum`
- **AND** não interrompe a renderização da aplicação
