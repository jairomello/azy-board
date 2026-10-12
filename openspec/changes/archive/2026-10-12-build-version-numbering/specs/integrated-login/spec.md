# Spec Delta

## ADDED Requirements

### Requirement: Exibição da versão do build na tela de login

A tela de login SHALL exibir, em um canto da tela, a versão do build e a data do
build, mesmo sem sessão ativa. O texto SHALL ser internacionalizado e não SHALL
expor informações além de versão e data.

#### Scenario: Versão visível antes do login

- **WHEN** a tela de login é carregada sem sessão ativa
- **THEN** a versão `YYYY.MM.DD.N` e a data do build são exibidas em um canto da tela

#### Scenario: Versão traduzida

- **WHEN** a tela de login é exibida em PT-BR, EN ou ES
- **THEN** o rótulo da versão aparece no idioma ativo, mantendo versão e data legíveis
