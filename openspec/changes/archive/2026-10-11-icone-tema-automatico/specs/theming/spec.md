## ADDED Requirements

### Requirement: Indicação do modo automático no botão de tema do header
Quando o "Tema automático por horário" estiver ligado, o botão de tema do header SHALL ficar desabilitado, SHALL exibir um ícone combinado de claro/escuro e SHALL apresentar, ao passar o mouse, a dica localizada de que a troca manual está desabilitada porque o modo automático está selecionado. Quando o modo automático estiver desligado, o botão SHALL manter o comportamento atual de alternância manual.

#### Scenario: Modo automático ligado desabilita o botão do header
- **WHEN** o modo automático por horário está ligado
- **THEN** o botão de tema do header fica desabilitado e exibe o ícone combinado de claro/escuro
- **AND** acionar o botão não altera o tema nem a preferência manual

#### Scenario: Dica ao passar o mouse
- **WHEN** o usuário posiciona o mouse sobre o botão de tema do header com o modo automático ligado
- **THEN** é exibida a dica "Desabilitado - modo automático selecionado." no idioma ativo

#### Scenario: Modo automático desligado mantém o botão ativo
- **WHEN** o modo automático está desligado
- **THEN** o botão de tema do header permanece habilitado, mostrando o ícone de claro/escuro correspondente ao tema atual
- **AND** clicar no botão alterna o tema como antes

#### Scenario: Estado compreensível sem mouse
- **WHEN** o usuário navega por teclado ou usa leitor de tela com o modo automático ligado
- **THEN** o botão expõe estado desabilitado e um rótulo acessível que comunica o motivo da indisponibilidade
