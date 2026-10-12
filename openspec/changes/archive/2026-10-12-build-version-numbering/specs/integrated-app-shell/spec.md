# Spec Delta

## ADDED Requirements

### Requirement: Exibição da versão do build na sidebar

A sidebar do shell SHALL exibir a versão e a data do build abaixo de "Trabalho
conectado" nas viewports em que a sidebar estendida é exibida. O texto SHALL ser
internacionalizado e não SHALL competir com os itens de navegação.

#### Scenario: Versão visível abaixo de "Trabalho conectado"

- **WHEN** um usuário autenticado acessa uma tela protegida com a sidebar estendida visível
- **THEN** a versão `YYYY.MM.DD.N` e a data do build aparecem abaixo de "Trabalho conectado"

#### Scenario: Versão traduzida

- **WHEN** a sidebar é exibida em PT-BR, EN ou ES
- **THEN** o rótulo da versão aparece no idioma ativo
