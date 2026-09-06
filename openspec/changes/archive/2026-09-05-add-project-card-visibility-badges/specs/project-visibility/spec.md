## ADDED Requirements

### Requirement: Badge de projeto restrito no card
O sistema SHALL exibir, no card de todo projeto com `isRestricted = true` na tela de projetos, um badge com ícone de cadeado e o texto "Restrito". O badge SHALL usar tom âmbar distinto dos tokens de situação de item e SHALL exibir, ao passar o mouse, um tooltip informando que apenas membros da equipe e o gerente visualizam o projeto.

#### Scenario: Card de projeto restrito exibe o badge
- **WHEN** a tela de projetos exibe um card de projeto com `isRestricted = true`
- **THEN** o card apresenta um badge com ícone de cadeado e o texto "Restrito"

#### Scenario: Card de projeto não restrito não exibe o badge
- **WHEN** a tela de projetos exibe um card de projeto com `isRestricted = false`
- **THEN** nenhum badge de restrição é renderizado

#### Scenario: Tooltip explica o significado
- **WHEN** o usuário passa o mouse sobre o badge "Restrito"
- **THEN** um tooltip é exibido informando que apenas membros da equipe e o gerente visualizam o projeto

#### Scenario: Tooltip não vaza para os demais cards
- **WHEN** o usuário passa o mouse sobre qualquer área do card que não seja o badge
- **THEN** nenhum tooltip de visibilidade é exibido em nenhum card da listagem

### Requirement: Badge de projeto oculto no card
O sistema SHALL exibir, no card de todo projeto com `isHidden = true` na tela de projetos, um badge com ícone de olho cortado e o texto "Oculto". O badge SHALL usar tom neutro e SHALL exibir, ao passar o mouse, um tooltip informando que o projeto não aparece na listagem por padrão.

#### Scenario: Card de projeto oculto exibe o badge
- **WHEN** a tela de projetos exibe um card de projeto com `isHidden = true`
- **THEN** o card apresenta um badge com ícone de olho cortado e o texto "Oculto"

#### Scenario: Card de projeto não oculto não exibe o badge
- **WHEN** a tela de projetos exibe um card de projeto com `isHidden = false`
- **THEN** nenhum badge de ocultação é renderizado

#### Scenario: Tooltip explica o significado
- **WHEN** o usuário passa o mouse sobre o badge "Oculto"
- **THEN** um tooltip é exibido informando que o projeto não aparece na listagem por padrão

### Requirement: Tratamento visual do card de projeto oculto
O sistema SHALL aplicar borda tracejada e opacidade reduzida ao card de todo projeto com `isHidden = true`, e SHALL restaurar a opacidade integral no hover e no foco do teclado. O sistema SHALL manter a faixa de gradiente do topo inalterada nesses cards.

#### Scenario: Card oculto com borda tracejada e opacidade reduzida
- **WHEN** um card de projeto oculto é renderizado
- **THEN** o card é exibido com borda tracejada e opacidade reduzida

#### Scenario: Opacidade é restaurada no hover
- **WHEN** o usuário passa o mouse sobre um card de projeto oculto
- **THEN** o card volta à opacidade integral

#### Scenario: Opacidade é restaurada no foco do teclado
- **WHEN** o card de projeto oculto recebe foco por teclado
- **THEN** o card volta à opacidade integral

#### Scenario: Card não oculto mantém o visual padrão
- **WHEN** um card de projeto com `isHidden = false` é renderizado
- **THEN** o card usa borda sólida e opacidade integral, mesmo que seja restrito

### Requirement: Composição e degradação das sinalizações no card
O sistema SHALL renderizar os badges na linha de rodapé do card, ao lado do texto "Abrir board", na ordem "Restrito" e depois "Oculto", sem alterar a altura do card em relação aos cards sem sinalização. O sistema SHALL tratar como `false` os campos de visibilidade ausentes no payload.

#### Scenario: Projeto restrito e oculto exibe os dois badges
- **WHEN** um card de projeto é exibido com `isRestricted = true` e `isHidden = true`
- **THEN** o card apresenta os badges "Restrito" e "Oculto", nessa ordem

#### Scenario: Badges não alteram a altura do card
- **WHEN** um card com sinalização é exibido ao lado de um card sem sinalização
- **THEN** ambos os cards mantêm a mesma altura

#### Scenario: Badges quebram linha em telas estreitas
- **WHEN** a largura do card não comporta o texto "Abrir board" e os badges na mesma linha
- **THEN** os badges são dispostos em linha adicional sem cortar o conteúdo

#### Scenario: Payload sem os campos de visibilidade
- **WHEN** um card é renderizado a partir de um payload sem `isRestricted` nem `isHidden`
- **THEN** nenhum badge é exibido e o card é renderizado normalmente

### Requirement: Sinalizações nos temas claro e escuro
O sistema SHALL exibir as sinalizações com contraste WCAG AA nos temas claro e escuro, usando pares explícitos de cor por tema.

#### Scenario: Badges no tema escuro
- **WHEN** a aplicação está em modo escuro e um card sinalizado é exibido
- **THEN** os badges usam as variantes escuras de cor, mantendo ícone e texto legíveis

#### Scenario: Badges no tema claro
- **WHEN** a aplicação está em modo claro e um card sinalizado é exibido
- **THEN** os badges usam as variantes claras de cor, mantendo ícone e texto legíveis
