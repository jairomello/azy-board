# Spec Delta

## ADDED Requirements

### Requirement: Item Ajuda na navegação da sidebar

A sidebar do `AppShell` SHALL apresentar um item `Ajuda` disponível a todo usuário autenticado, posicionado depois de `Conta` e antes do grupo `Admin`, com rótulo internacionalizado, e SHALL abrir a central de ajuda.

#### Scenario: Item visível para todo usuário autenticado

- **WHEN** qualquer usuário autenticado acessa uma tela protegida
- **THEN** o item `Ajuda` aparece na navegação da sidebar

#### Scenario: Ordem da navegação preservada

- **WHEN** um usuário com grupo global `ADMIN` ou `ROOT` acessa a aplicação
- **THEN** o item `Ajuda` aparece depois de `Conta`
- **AND** o grupo `Admin` continua sendo o último item da sidebar

#### Scenario: Item abre a central de ajuda

- **WHEN** o usuário aciona o item `Ajuda`
- **THEN** a central de ajuda é aberta

#### Scenario: Rótulo traduzido

- **WHEN** a sidebar é exibida em PT-BR, EN ou ES
- **THEN** o rótulo do item de ajuda aparece no idioma ativo
