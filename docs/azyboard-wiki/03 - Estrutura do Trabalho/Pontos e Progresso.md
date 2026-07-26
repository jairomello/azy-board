---
title: Pontos e Progresso
type: guide
order: 3
---

# Pontos e Progresso

Pontos representam estimativa. Progresso representa a proporção de itens folha concluídos dentro de um item agregador.

## Pontos em itens folha

Tasks e bugs folha podem receber uma quantidade inteira de pontos. O valor é informado na janela de detalhes do item.

Os pontos podem representar esforço, complexidade ou outra unidade definida pela equipe. O Azy Board não impõe uma escala específica.

## Pontos em itens agregadores

Itens pai não precisam ser estimados novamente. Seu total corresponde à soma dos pontos dos itens folha descendentes.

Exemplo:

| Item folha | Pontos |
|---|---:|
| Validar cartão | 3 |
| Registrar cobrança | 5 |
| Enviar comprovante | 2 |
| **Total do pai** | **10** |

Quando a pontuação de um item folha muda, os totais dos ancestrais também são atualizados.

## Cálculo do progresso

O progresso considera a quantidade de itens folha concluídos:

```text
progresso = itens folha concluídos / total de itens folha × 100
```

Se um item possui quatro descendentes folha e três estão concluídos, seu progresso é de 75%.

## Propagação pela hierarquia

Concluir uma subtask pode alterar o progresso de toda a cadeia:

```text
Subtask > Task pai > História > Épico
```

Cada ancestral considera todos os itens folha abaixo dele, não somente os filhos diretos.

## Onde consultar

### Card

Cards apresentam a pontuação individual quando disponível. Itens com filhos também podem exibir indicadores de sua estrutura.

### Swimlane

O resumo de um épico permite acompanhar a distribuição e o avanço dos cards associados.

### Visualização em árvore

A árvore possui colunas próprias para:

- Pontos.
- Progresso percentual.
- Barra visual de progresso.

Essa é a visualização mais adequada para comparar níveis diferentes da hierarquia.

## Como atualizar a estimativa

1. Abra uma task ou bug folha.
2. Localize o campo **Pontos**.
3. Informe um número inteiro igual ou maior que zero.
4. Salve o item.
5. Consulte os totais atualizados nos ancestrais.

## Como avançar o progresso

1. Identifique os itens folha pendentes.
2. Execute e mova cada item para uma coluna concluída ou altere seu status para **Concluída**.
3. Consulte o item pai ou a árvore.
4. Confirme a nova porcentagem.

## Regras e comportamentos

- Pontos são opcionais.
- O valor zero não contribui para a soma.
- A pontuação direta é aplicada ao trabalho folha.
- A pontuação de pais é consolidada a partir dos descendentes.
- Somente itens folha concluídos contam como concluídos no cálculo.
- Itens bloqueados, cancelados ou em andamento não contam como concluídos.
- O cálculo percorre toda a profundidade da árvore.

## Exemplo prático

Uma história possui duas tasks. A primeira tem 3 pontos e está concluída. A segunda foi dividida em subtasks de 2 e 5 pontos, das quais apenas uma está concluída. A história consolida 10 pontos e apresenta 67% de progresso, pois dois dos três itens folha estão concluídos.

## Funcionalidades relacionadas

- [[03 - Estrutura do Trabalho/Leaf Rule e Itens Agregadores|Leaf Rule e itens agregadores]]
- [[04 - Board e Visualizacoes/Visualizacao em Arvore|Visualização em árvore]]
- [[06 - Tasks Bugs e Subtasks/Tasks Bugs e Subtasks|Tasks, Bugs e Subtasks]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Agregação

O serviço percorre os descendentes de um item, identifica folhas operacionais e calcula soma de pontos e percentual concluído. O resultado é disponibilizado às visualizações que apresentam itens pai.

### Mudanças

Alterações de status, pontos ou hierarquia invalidam os valores agregados dos ancestrais. A cadeia é recalculada até o épico correspondente.

### Estado concluído

O cálculo usa o status de domínio `DONE` como condição de conclusão. A movimentação para uma coluna com status base concluído produz o mesmo efeito.

</details>

