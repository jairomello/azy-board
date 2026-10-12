# Spec Delta

## ADDED Requirements

### Requirement: Chip do filtro de última alteração

O filtro de alteração ativo SHALL ser exibido como chip removível com o rótulo legível da janela selecionada (por exemplo, "Alterados: último dia"), tanto na linha de filtros ativos quanto no resumo do cabeçalho compacto, com textos em PT-BR, EN e ES. O estado neutro SHALL NOT gerar chip.

#### Scenario: Chip exibido com rótulo da janela

- **WHEN** uma janela de alteração está aplicada
- **THEN** um chip com o rótulo legível da janela é exibido com botão acessível de remoção

#### Scenario: Remover o chip

- **WHEN** o usuário aciona o botão de remoção do chip
- **THEN** somente o filtro de alteração volta ao estado neutro, o Board é recalculado e os demais chips permanecem

#### Scenario: Estado neutro sem chip

- **WHEN** a dimensão de alteração está no estado neutro
- **THEN** nenhum chip de alteração é exibido

#### Scenario: Fuso e idioma

- **WHEN** o chip é renderizado em qualquer idioma suportado
- **THEN** o rótulo da janela é traduzido sem expor detalhes internos de cálculo
