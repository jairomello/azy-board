# Spec Delta

## ADDED Requirements

### Requirement: Filtro por janela de última alteração

O sistema SHALL oferecer, no painel `Filtros`, uma dimensão "Alterados" com as opções: último dia, últimos 2, 3 e 5 dias, última semana, sprint atual e último mês. As opções de tempo SHALL selecionar cards cujo `updatedAt` seja igual ou posterior ao início do dia da janela, no fuso do projeto (America/Sao_Paulo), e SHALL ser aplicadas client-side sobre os itens já carregados.

#### Scenario: Opção "último dia"

- **WHEN** o usuário seleciona "último dia"
- **THEN** apenas cards cuja última alteração ocorreu desde 00:00 de ontem (fuso do projeto) são exibidos

#### Scenario: Opções numéricas de dias

- **WHEN** o usuário seleciona 2, 3 ou 5 dias
- **THEN** apenas cards alterados desde 00:00 do dia correspondente (N dias atrás) são exibidos

#### Scenario: Opção "última semana" e "último mês"

- **WHEN** o usuário seleciona "última semana" ou "último mês"
- **THEN** a janela corresponde a 7 ou 30 dias-calendário para trás, respectivamente

#### Scenario: Opção "sprint atual"

- **WHEN** o usuário seleciona "sprint atual"
- **THEN** apenas cards vinculados à sprint vigente (sprint `OPEN` cujo intervalo contém o dia atual; menor `createdAt` em empate) são exibidos, independentemente da janela de tempo

#### Scenario: Combinação com outros filtros

- **WHEN** o filtro de alteração está ativo junto de outro filtro de conteúdo
- **THEN** os critérios são combinados por AND e apenas cards que satisfazem ambos são exibidos

#### Scenario: Card sem alteração recente

- **WHEN** o filtro de alteração está ativo e um card tem `updatedAt` anterior à janela
- **THEN** o card não é exibido

#### Scenario: Limpar o filtro de alteração

- **WHEN** o usuário volta a dimensão "Alterados" ao estado neutro
- **THEN** o filtro deixa de recortar cards e os demais filtros permanecem inalterados

#### Scenario: Contabilizado no indicador de filtros ativos

- **WHEN** o filtro de alteração está ativo
- **THEN** ele conta como filtro ativo no indicador do toolbar e no resumo do cabeçalho compacto
