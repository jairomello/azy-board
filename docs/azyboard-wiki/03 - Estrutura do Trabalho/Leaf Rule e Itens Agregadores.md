---
title: Leaf Rule e Itens Agregadores
type: guide
order: 2
---

# Leaf Rule e Itens Agregadores

A Leaf Rule diferencia itens diretamente executáveis de itens que passaram a consolidar o trabalho de seus filhos.

## O que é um item folha

Um item folha é um item sem filhos. Ele representa o ponto mais específico de um ramo da hierarquia.

Exemplos:

- Uma task sem subtasks.
- Um bug sem tarefas de correção abaixo dele.
- Uma subtask que ainda não foi dividida.
- Uma história sem tasks ou bugs.

## O que é um item agregador

Quando um item recebe seu primeiro filho, deixa de ser folha e passa a ser agregador. Em vez de representar uma única execução, ele resume o trabalho dos descendentes.

Um agregador pode apresentar:

- Quantidade de filhos.
- Soma dos pontos dos itens folha.
- Percentual de progresso.
- Aviso de que sua movimentação depende dos filhos.

## Participação no Kanban

| Tipo e situação | Aparece como card | Pode ser arrastado |
|---|---:|---:|
| Épico | Não, forma a lane principal | Não |
| História no modo lanes | Não, forma uma lane interna | Não |
| História sem filhos no modo cards | Sim | Sim |
| História com filhos no modo cards | Sim como referência | Não |
| Task ou bug sem filhos | Sim | Sim |
| Task ou bug com filhos | Pode aparecer como primeiro nível | Não |
| Subtask folha | Sim quando subtasks estão visíveis | Sim |

## Modos de histórias no Board

No modo padrão **Histórias como lanes**:

- Cada história forma uma lane horizontal dentro do épico.
- Tasks e bugs são distribuídos nas colunas internas da história.
- Histórias e épicos possuem accordions independentes.
- Uma história vazia continua visível, salvo quando **Ocultar histórias vazias** está ativo.

No modo **Histórias como cards**:

- Histórias folha aparecem como cards reais e móveis.
- Histórias sem coluna definida são apresentadas inicialmente na primeira coluna.
- Histórias com filhos aparecem como referências não arrastáveis.
- Clicar no card de uma história abre sua janela específica de edição.

Épicos nunca são cards móveis, mesmo quando não possuem histórias.

## Controle de subtasks

O controle **Mostrar subtasks** altera o nível operacional apresentado:

### Desativado

O Board privilegia tasks e bugs do primeiro nível abaixo das histórias, além dos itens órfãos. Um item pai pode aparecer para representar esse nível, mas não pode ser arrastado se possuir filhos.

### Ativado

O Board percorre a decomposição e apresenta os itens folha. As subtasks executáveis aparecem, enquanto os respectivos pais funcionam como agregadores.

## Criar a primeira subtask

Quando uma task folha recebe uma subtask:

1. A task pai deixa de ser folha.
2. O indicador de filhos passa a ser exibido.
3. Sua movimentação manual é bloqueada.
4. A subtask passa a representar o trabalho executável.
5. Pontos e progresso passam a ser consolidados no pai.

## Por que um card não pode ser arrastado

Ao abrir um item com filhos, a aplicação informa que seu estado no Board é determinado pelo progresso dos filhos. Para avançá-lo, mova ou conclua os itens folha descendentes.

## Regras e comportamentos

- A condição de folha é calculada pela existência de filhos.
- Criar ou excluir filhos pode mudar essa condição.
- Itens agregadores não devem ter seu fluxo alterado independentemente dos descendentes.
- Uma história folha pode assumir coluna e status como card operacional somente no modo de histórias como cards.
- No modo de lanes, a história permanece como agrupador independentemente de possuir filhos.
- Uma história com filhos permanece no primeiro estágio visual como referência quando o modo de cards está ativo.
- A alternância de subtasks modifica a visualização, não a hierarquia armazenada.

## Exemplo prático

A task **Implementar cobrança** começa como folha e pode ser movida. Depois que recebe as subtasks **Criar endpoint** e **Integrar gateway**, torna-se agregadora. As duas subtasks passam a ser movidas individualmente, e a task pai acompanha o progresso delas.

## Funcionalidades relacionadas

- [[03 - Estrutura do Trabalho/Hierarquia dos Itens|Hierarquia dos itens]]
- [[03 - Estrutura do Trabalho/Pontos e Progresso|Pontos e progresso]]
- [[04 - Board e Visualizacoes/Controles de Visualizacao do Board|Controles de visualização do Board]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Cálculo de folha

Um item é folha quando nenhum outro item ativo utiliza seu identificador como pai. A API valida essa condição antes de aceitar uma movimentação.

### Cards reais e referências

Tasks, bugs e histórias folha no modo de cards utilizam seus identificadores reais. Histórias agregadoras podem ser adaptadas pelo frontend para aparecer como referências não persistentes e não arrastáveis. No modo de lanes, histórias são agrupadores derivados do `ancestryPath`.

### Atualização da hierarquia

Eventos de criação e exclusão fazem o frontend recalcular quais itens são folha. A API continua sendo a autoridade para impedir movimentações inválidas.

</details>
