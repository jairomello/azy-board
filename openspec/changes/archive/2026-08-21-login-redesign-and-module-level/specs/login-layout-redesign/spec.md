## ADDED Requirements

### Requirement: Layout da LoginPage com box de login compacto e centralizado
O sistema SHALL renderizar a LoginPage com o box de login verticalmente compacto, com margens superior e inferior generosas, centralizado no painel direito do card. O layout SHALL preparar a estrutura para suportar uma imagem de papel de parede no fundo.

#### Scenario: Box de login com altura reduzida
- **WHEN** usuário acessa a tela de login em desktop (lg+)
- **THEN** o formulário de login ocupa apenas o espaço necessário para seus campos, sem esticar verticalmente para preencher o card
- **AND** o padding vertical do painel direito é aumentado para `py-20` (vs `p-16` anterior)

#### Scenario: Centralização vertical do formulário
- **WHEN** a LoginPage é renderizada
- **THEN** o formulário de login está centralizado verticalmente no painel direito com espaço visual equilibrado acima e abaixo

#### Scenario: Estrutura para papel de parede futuro
- **WHEN** a LoginPage é renderizada
- **THEN** existe uma `div` absoluta de fundo no card preparada para receber uma imagem via `background-image`, sem imagem aplicada no momento

#### Scenario: Responsividade mantida em telas menores
- **WHEN** usuário acessa a tela de login em mobile
- **THEN** o layout mantém padding responsivo (`py-10` mobile, `py-16` sm, `py-20` lg) e o formulário permanece legível e acessível

#### Scenario: Card externo sem overflow
- **WHEN** a LoginPage é renderizada em qualquer tamanho de tela
- **THEN** o card não causa overflow vertical na viewport e o conteúdo é totalmente visível sem scroll
