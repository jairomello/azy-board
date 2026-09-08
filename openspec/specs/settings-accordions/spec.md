## Purpose

Definir os requisitos da capacidade settings-accordions.

## Requirements

### Requirement: Seções da SettingsPage em accordions
O sistema SHALL renderizar todas as seções da página de configurações do projeto (`SettingsPage`) usando o componente `AccordionSection`, com um `AccordionToolbar` no topo fornecendo os botões "Expandir tudo" e "Recolher tudo".

#### Scenario: Página carrega com duas primeiras seções abertas
- **WHEN** administrador acessa a tela de configurações do projeto
- **THEN** as seções "Formato do board" e "Visibilidade do projeto" estão expandidas e as demais estão recolhidas

#### Scenario: Expandir tudo
- **WHEN** administrador clica em "Expandir tudo"
- **THEN** todas as seções visíveis ficam expandidas simultaneamente

#### Scenario: Recolher tudo
- **WHEN** administrador clica em "Recolher tudo"
- **THEN** todas as seções ficam recolhidas simultaneamente

#### Scenario: Toggle individual de seção
- **WHEN** administrador clica no cabeçalho de uma seção recolhida
- **THEN** a seção é expandida; se estava expandida, é recolhida

#### Scenario: Seção Módulos condicional em accordions
- **WHEN** o projeto está em modo `HIERARCHICAL`
- **THEN** a seção "Módulos" participa do sistema de accordions e pode ser expandida/recolhida

#### Scenario: Seção Módulos oculta em modo SIMPLE
- **WHEN** o projeto está em modo `SIMPLE`
- **THEN** a seção "Módulos" não aparece no accordion nem no toolbar

### Requirement: Contador de acessibilidade do accordion
O `AccordionToolbar` SHALL exibir um contador screen-reader-only indicando `{abertas} / {total}` seções abertas.

#### Scenario: Contador atualizado ao expandir
- **WHEN** usuário expande uma seção
- **THEN** o contador screen-reader-only atualiza para refletir o novo total de seções abertas
