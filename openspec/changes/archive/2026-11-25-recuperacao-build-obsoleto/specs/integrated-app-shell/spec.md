## ADDED Requirements

### Requirement: Aviso não bloqueante de nova versão

O shell SHALL exibir um aviso não bloqueante quando houver build publicado mais
novo que o bundle em uso, informando a versão publicada e oferecendo a ação de
recarregar a página. O aviso SHALL aparecer também na tela de login, SHALL poder
ser dispensado pelo usuário e SHALL NOT deslocar o layout do shell quando
ausente. O aviso SHALL continuar disponível após o usuário dispensá-lo apenas se
uma checagem posterior confirmar um build diferente.

#### Scenario: Aviso em tela autenticada

- **WHEN** há build novo e o usuário está em uma tela protegida
- **THEN** o aviso aparece sobre o conteúdo, sem cobrir a navegação, com a versão publicada e o botão de recarregar

#### Scenario: Aviso na tela de login

- **WHEN** há build novo e o usuário está na tela de login
- **THEN** o aviso aparece com a mesma ação de recarregar

#### Scenario: Aviso dispensado

- **WHEN** o usuário dispensa o aviso
- **THEN** o aviso some sem alterar a versão em uso até que o usuário recarregue

#### Scenario: Sem build novo

- **WHEN** a versão publicada é igual à do bundle
- **THEN** nenhum espaço ou elemento de aviso é renderizado
