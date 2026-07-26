---
title: Controles de Visualização do Board
type: guide
order: 5
---

# Controles de Visualização do Board

Os controles de visualização modificam a forma de apresentar o mesmo projeto. Eles não alteram hierarquia, status ou conteúdo dos itens.

## Mostrar subtasks

Esse controle alterna o nível operacional apresentado no Kanban.

### Controle desativado

O Board mostra tasks e bugs do primeiro nível abaixo das histórias, além de itens órfãos. Essa visão é útil para acompanhar pacotes maiores de execução.

### Controle ativado

O Board mostra os itens folha na profundidade atual da hierarquia. Subtasks executáveis aparecem no lugar dos pais agregadores.

> [!tip] Quando usar
> Desative para uma visão resumida por história. Ative para acompanhar o trabalho que pode ser movimentado e concluído individualmente.

## Exibição das histórias

Esse controle alterna entre duas representações da mesma hierarquia.

### Histórias como lanes

É o modo padrão. Cada história aparece como uma lane horizontal dentro do épico e contém suas próprias colunas e cards. Épicos e histórias podem ser expandidos ou recolhidos de forma independente.

### Histórias como cards

Preserva o comportamento anterior:

- História sem filhos: card real, com movimentação entre colunas.
- História com filhos: referência não arrastável na primeira etapa do fluxo.
- Tasks e bugs continuam agrupados pela lane do épico.

O tooltip do botão informa qual modo será ativado ao clicar.

## Expandir tudo

Abre todas as lanes de épico, todas as lanes de história e a lane **Sem épico**. Use quando precisar comparar cards de vários níveis.

## Recolher tudo

Fecha todas as lanes e mantém somente seus cabeçalhos e contagens. No modo de histórias como lanes, épicos e histórias têm seus estados atualizados.

Expandir e recolher tudo estão disponíveis somente no Kanban.

## Ocultar épicos vazios

Remove swimlanes sem cards visíveis depois dos filtros. Diferentemente dos outros controles desta página, ele participa da contagem de filtros e é desativado pela ação **Limpar**.

## Ocultar histórias vazias

Disponível somente no modo **Histórias como lanes**. Remove temporariamente histórias sem cards visíveis depois dos demais filtros. O controle participa da contagem de filtros e é desativado pela ação **Limpar**.

## Itens arquivados

O controle de arquivo abre a relação de itens retirados das visualizações ativas. Ele não é um filtro: trata-se de uma área própria para consulta e restauração.

## Tooltips e estado ativo

Os controles compactos utilizam ícones. Posicionar o cursor sobre eles apresenta o nome da ação.

Quando um controle está ativo, recebe destaque visual. Isso permite identificar rapidamente o modo de histórias, a exibição de subtasks e as ocultações de lanes vazias.

## Persistência

São lembrados separadamente para cada projeto:

- Exibição de subtasks.
- Modo de histórias: lanes ou cards.
- Ocultação de épicos vazios.
- Ocultação de histórias vazias.
- Lanes de épico recolhidas.
- Lanes de história recolhidas.
- Filtros de conteúdo.

Ao usar **Limpar**, o modo de histórias e a exibição de subtasks mantêm seu estado atual. Os filtros e as ocultações de lanes vazias retornam ao padrão.

## Valores padrão

| Controle | Valor inicial |
|---|---|
| Mostrar subtasks | Desativado |
| Exibição das histórias | Lanes |
| Ocultar épicos vazios | Desativado |
| Ocultar histórias vazias | Desativado |
| Lanes de épico e história | Expandidas |

## Permissões

Todos os papéis podem usar controles de visualização. As preferências afetam somente o navegador da pessoa e não modificam a visão de outros participantes.

## Funcionalidades relacionadas

- [[03 - Estrutura do Trabalho/Leaf Rule e Itens Agregadores|Leaf Rule e itens agregadores]]
- [[04 - Board e Visualizacoes/Filtros do Board|Filtros do Board]]
- [[04 - Board e Visualizacoes/Swimlanes e Colunas|Swimlanes e colunas]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Estado derivado

Os controles fazem parte do estado de filtros do Board. O frontend deriva a coleção de cards a partir dos itens carregados, dos pais existentes e dos valores dos controles.

### Persistência local

Filtros e toggles são salvos em uma chave por projeto. Lanes recolhidas utilizam duas chaves separadas: uma para os identificadores de épicos e outra para histórias.

### Compatibilidade

Preferências antigas que ainda possuem `showStories` migram para o modo padrão de histórias como lanes. Outros valores ausentes são combinados com os padrões. Dados inválidos ou armazenamento indisponível não impedem o funcionamento do Board.

</details>
