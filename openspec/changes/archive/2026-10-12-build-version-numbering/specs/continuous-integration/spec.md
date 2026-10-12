# Spec Delta

## ADDED Requirements

### Requirement: Geração e propagação da versão do build no pipeline

O pipeline de build/CI SHALL gerar a versão `YYYY.MM.DD.N` e propagá-la para os
artefatos publicados (bundle web, API e imagens), de forma que a versão exibida
e a versão publicada coincidam. A falha na geração SHALL reprovar o build.

#### Scenario: Pipeline associa a versão aos artefatos

- **WHEN** o pipeline executa o build de um commit
- **THEN** a versão `YYYY.MM.DD.N` gerada é incorporada ao bundle web e à imagem/API publicados

#### Scenario: Versão exibida coincide com a publicada

- **WHEN** um build publicado é aberto no login ou na sidebar
- **THEN** a versão exibida corresponde ao build gerado por aquele pipeline

#### Scenario: Falha na geração reprova o build

- **WHEN** a etapa de geração da versão falha
- **THEN** o build é reprovado e nenhum artefato é publicado
