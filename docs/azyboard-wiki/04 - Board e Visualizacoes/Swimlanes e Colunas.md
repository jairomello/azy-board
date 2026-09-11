---
title: Swimlanes e Colunas
type: guide
order: 2
---

# Swimlanes e Colunas

Lanes agrupam o trabalho em dois níveis: épico e história. Colunas representam as etapas pelas quais os cards passam dentro do agrupamento ativo.

## Hierarquia padrão

O modo padrão representa:

```text
Épico
└── História
    └── Colunas
        └── Cards
```

A lane de história é indentada e conectada visualmente à lane do épico. Isso mantém o contexto hierárquico sem misturar histórias com cards executáveis.

## Como interpretar a lane de épico

O cabeçalho contém:

- Nome do épico.
- Quantidade de histórias visíveis.
- Quantidade de cards descendentes.
- Percentual de progresso.
- Ação de edição.
- Controle de accordion.

## Como interpretar a lane de história

O cabeçalho interno contém:

- Identificação visual de história.
- Título.
- Quantidade de cards.
- Percentual de progresso.
- Ação de edição.
- Accordion independente.

Quando expandida, a história apresenta a sequência completa de colunas. Cards criados por **Adicionar card** nesse contexto já recebem a história como pai.

## Expandir ou recolher uma lane

1. Localize o épico ou a história.
2. Selecione o cabeçalho ou o ícone de expansão.
3. Quando expandida, a faixa mostra o nível imediatamente abaixo.
4. Quando recolhida, mostra somente o resumo.

O estado de cada épico e história é lembrado separadamente para cada projeto. Recolher um épico oculta temporariamente todas as histórias abaixo dele sem apagar o estado individual de cada uma.

## Expandir ou recolher todas

No painel **Opções** do Kanban:

- Use **Expandir tudo** para abrir todas as lanes de épico e história.
- Use **Recolher tudo** para manter apenas os cabeçalhos.

Esses controles não aparecem na visualização em árvore.

## Editar o épico da swimlane

1. Localize a ação de edição no cabeçalho.
2. Abra a janela do épico.
3. Altere título, módulo, versão ou descrição.
4. Salve.

O novo título passa a identificar a swimlane e os breadcrumbs descendentes.

## Lane Sem épico

Tasks e bugs sem um épico ancestral aparecem em **Sem épico**. Essa lane:

- Pode ser expandida ou recolhida.
- Apresenta as mesmas colunas.
- Permite criar e movimentar cards.
- Não possui ação de edição de épico.

Vincular um item a uma história faz com que ele passe para a swimlane do épico correspondente.

## Agrupamento Sem história

Cards que possuem um épico ancestral, mas não possuem uma história ancestral, aparecem em **Sem história** dentro daquele épico. Esse agrupamento utiliza as mesmas colunas, pode ser expandido ou recolhido e não possui ação de edição de história.

## Histórias como cards

O toggle de histórias pode substituir as lanes internas pelo modo de cards. Nesse modo:

- Histórias folha aparecem como cards móveis.
- Histórias com filhos aparecem como referências não arrastáveis.
- Tasks e bugs voltam a ser exibidos diretamente nas colunas da lane de épico.
- O filtro **Ocultar histórias vazias** deixa de ser exibido.

## Como interpretar uma coluna

Cada coluna possui:

- Nome visível.
- Status base.
- Posição no fluxo.
- Contagem de cards por swimlane.

O nome descreve a etapa específica. O status base traduz essa etapa para um estado geral do item.

O conteúdo da coluna possui um afastamento superior de 10 px depois do cabeçalho. O espaçamento evita que o primeiro card pareça colado à barra de título e se aplica a todos os níveis de lane.

## Reordenar colunas

1. Posicione o cursor sobre o cabeçalho da coluna.
2. Arraste pela área de controle.
3. Solte sobre outra posição.
4. A nova ordem é aplicada a todas as swimlanes.

Se a alteração não puder ser salva, a ordem anterior é restaurada e a aplicação apresenta uma mensagem de erro.

## Configurar colunas

A criação, renomeação, definição de status base e exclusão são realizadas em [[07 - Configuracoes do Projeto/Configuracoes do Projeto|Configurações do Projeto]].

Ao excluir uma coluna que possui cards, o administrador escolhe outra coluna para recebê-los.

## Ocultar épicos vazios

O controle **Ocultar épicos vazios** remove temporariamente swimlanes sem cards visíveis. O cálculo considera os filtros ativos.

Quando um squad é selecionado, épicos sem trabalho visível para o squad também são ocultados para reduzir ruído.

## Ocultar histórias vazias

No modo de histórias como lanes, o controle **Ocultar histórias vazias** remove temporariamente histórias sem cards visíveis após os filtros. Histórias vazias voltam a aparecer ao desativar o controle ou ao limpar os filtros.

## Regras e comportamentos

- Cada épico corresponde a uma lane principal.
- No modo padrão, cada história corresponde a uma lane interna.
- Todas as lanes de história compartilham a mesma ordem de colunas.
- A contagem é calculada por lane e coluna.
- Recolher não remove nem altera cards.
- A ordem e os estados recolhidos persistem após sair do projeto.
- Épicos e histórias arquivados não aparecem entre as lanes ativas.

## Permissões

Todos os participantes podem expandir e recolher. `Admin` e `Membro` podem reordenar colunas no Board. Apenas `Admin` altera a configuração estrutural das colunas.

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Conhecer o Board|Conhecer o Board]]
- [[04 - Board e Visualizacoes/Filtros do Board|Filtros do Board]]
- [[07 - Configuracoes do Projeto/Configuracoes do Projeto|Configurações do Projeto]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Swimlanes derivadas

O frontend agrupa cards pelo épico e pela história encontrados no ancestry path. A lane órfã recebe itens sem épico ancestral, enquanto **Sem história** recebe cards que possuem épico, mas não história.

### Persistência visual

Os identificadores das lanes recolhidas são armazenados no navegador por projeto, em chaves distintas para épicos e histórias. Expandir ou recolher não produz mutações nos itens.

### Ordenação de colunas

Ao soltar uma coluna, a interface calcula a nova ordem e envia a sequência de identificadores à API. As posições são persistidas e aplicadas globalmente ao projeto.

</details>
