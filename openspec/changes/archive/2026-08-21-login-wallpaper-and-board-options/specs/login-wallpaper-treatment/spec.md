## ADDED Requirements

### Requirement: Wallpaper tratado na tela de login

A tela de login SHALL renderizar o wallpaper com desfoque gaussiano forte e uma camada escura, mantendo o card de login nítido e visualmente destacado por sombra.

#### Scenario: Fundo desfocado e escurecido

- **WHEN** a LoginPage é exibida com `login-wallpaper.jpeg`
- **THEN** a imagem de fundo aparece desfocada e escurecida atrás do card

#### Scenario: Card legível sobre o wallpaper

- **WHEN** o card de login é renderizado sobre a imagem tratada
- **THEN** os textos, campos e botões permanecem nítidos e o card possui sombra suficiente para se separar do fundo

#### Scenario: Responsividade do tratamento

- **WHEN** a tela é exibida em desktop, tablet ou mobile
- **THEN** o wallpaper cobre a viewport sem distorcer o layout do card e sem criar overflow horizontal
