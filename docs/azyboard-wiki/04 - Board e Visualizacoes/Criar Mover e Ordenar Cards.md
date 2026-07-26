---
title: Criar, Mover e Ordenar Cards
type: guide
order: 3
---

# Criar, Mover e Ordenar Cards

Cards podem ser criados diretamente no fluxo, movidos entre etapas e ordenados dentro de uma coluna.

## Criar pela toolbar

1. No Kanban, selecione **Task** ou **Bug** na toolbar.
2. A janela completa do item é aberta.
3. Preencha os campos necessários.
4. Salve.

O novo item utiliza inicialmente a primeira coluna, salvo quando outro contexto de criação já determina a coluna.

## Criar diretamente em uma coluna

1. Abra a lane desejada.
2. No modo padrão, expanda a história que deve receber o card.
3. Na parte inferior da coluna, selecione **Adicionar card**.
4. Informe o título.
5. Escolha `Task` ou `Bug`.
6. Confirme.

Essa criação é indicada para registrar rapidamente trabalho já posicionado em uma etapa. Quando realizada dentro de uma lane de história, o novo card recebe automaticamente essa história como pai.

## Editar o título no Board

1. Localize o card.
2. Ative a edição do título.
3. Digite o novo texto.
4. Confirme ou clique fora para salvar.

Abrir o corpo do card apresenta os demais detalhes.

## Mover para outra coluna

1. Confirme que o card possui controle de arraste ativo.
2. Arraste o card pela alça lateral.
3. Posicione-o sobre a coluna de destino.
4. Solte.
5. O card assume o status base da nova coluna.

A atualização aparece imediatamente. Se o salvamento falhar, o card retorna à posição anterior.

## Ordenar dentro da mesma coluna

1. Arraste um card móvel.
2. Posicione-o sobre outro card da mesma coluna.
3. Solte na posição desejada.

A sequência vertical é salva para manter a organização em acessos posteriores.

## Cards que podem ser movidos

- Tasks folha.
- Bugs folha.
- Subtasks folha quando estão visíveis.
- Histórias folha quando o modo **Histórias como cards** está ativo.

Épicos e itens com filhos não podem ser arrastados.

## Mover histórias folha no modo de cards

Histórias sem tasks podem participar diretamente do fluxo quando a exibição está em **Histórias como cards**. Quando ainda não possuem coluna, são exibidas na primeira coluna. O primeiro movimento explícito salva sua coluna e seu status. No modo padrão de lanes, histórias funcionam como agrupadores e não são arrastadas entre colunas.

## Arrastar sobre cards ou espaços vazios

Um card pode ser solto:

- Sobre uma coluna vazia.
- No espaço livre de uma coluna.
- Sobre outro card para determinar posição.

A aplicação prioriza o elemento menor sob o cursor para distinguir cards de colunas.

## Excluir pelo Board

A ação de exclusão aparece ao posicionar o cursor sobre o card. Antes de excluir, a aplicação solicita confirmação e informa que filhos e conteúdos relacionados também serão removidos.

> [!danger] Exclusão permanente
> Exclusão e arquivamento são ações diferentes. Para retirar um item sem perdê-lo, utilize o arquivamento.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Criar card | Sim | Sim | Não |
| Editar título | Sim | Sim | Não |
| Mover e ordenar | Sim | Sim | Não |
| Excluir | Sim | Sim | Não |

## Exemplo prático

Uma pessoa cria o bug **Cobrança duplicada** diretamente em **Backlog**. Depois da triagem, arrasta o card para **A Fazer**. Quando o trabalho começa, move para **Fazendo**, atualizando automaticamente o status para em andamento.

## Funcionalidades relacionadas

- [[03 - Estrutura do Trabalho/Leaf Rule e Itens Agregadores|Leaf Rule e itens agregadores]]
- [[04 - Board e Visualizacoes/Arquivar Restaurar e Excluir Itens|Arquivar, restaurar e excluir itens]]
- [[06 - Tasks Bugs e Subtasks/Tasks Bugs e Subtasks|Tasks, Bugs e Subtasks]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Drag-and-drop

Cards e colunas utilizam identificadores distintos no contexto de drag. A detecção considera primeiro o ponteiro e depois a interseção dos elementos.

### Movimentação

A interface aplica coluna e status de forma otimista e solicita a movimentação à API. O backend confirma tenant, projeto, papel, tipo, condição de folha e coluna de destino antes de persistir.

### Ordenação

Na mesma coluna, a sequência visível é convertida em posições numéricas. Cards de referência que não existem como itens móveis são excluídos dessa atualização.

</details>
