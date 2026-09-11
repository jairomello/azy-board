---
title: Gerenciar Colunas do Board
type: guide
order: 1
---

# Gerenciar Colunas do Board

As colunas representam as etapas pelas quais o trabalho passa no Board. Cada coluna possui um nome visível e um **status base**, usado pela aplicação para interpretar o estado dos cards posicionados nela.

## Onde encontrar

1. Abra o projeto.
2. Acesse **Configurações** pelo cabeçalho do Board.
3. Localize a seção **Colunas**.

Todos os participantes podem consultar a configuração. As ações de criação, edição e exclusão ficam disponíveis para administradores.

## Entender nome e status base

O nome descreve a etapa para a equipe, como `Backlog`, `Em desenvolvimento` ou `Homologação`. O status base padroniza o significado dessa etapa:

| Status base | Significado funcional |
|---|---|
| `NOT_STARTED` | Trabalho ainda não iniciado. |
| `IN_PROGRESS` | Trabalho em andamento. |
| `BLOCKED` | Trabalho impedido de avançar. |
| `DONE` | Trabalho concluído. |
| `CANCELLED` | Trabalho cancelado. |

Colunas diferentes podem compartilhar o mesmo status base. Por exemplo, `Desenvolvimento` e `Revisão` podem representar etapas distintas do fluxo e ainda indicar trabalho em andamento.

## Criar uma coluna

1. Informe o nome da nova coluna.
2. Selecione seu status base.
3. Selecione **Nova coluna**.

A coluna é adicionada ao final do fluxo e passa a aceitar cards imediatamente.

## Renomear uma coluna

1. Selecione o ícone de edição da coluna.
2. Altere o nome.
3. Confirme no ícone de confirmação ou pressione `Enter`.

Use `Esc` ou o ícone de cancelamento para abandonar a alteração. Renomear uma coluna não altera seus cards nem seu status base.

## Reordenar as colunas

No Board, arraste o cabeçalho de uma coluna para a posição desejada. A nova ordem é persistida para o projeto e passa a ser vista pelos demais participantes.

A ordem deve refletir o fluxo normal de execução da esquerda para a direita.

## Excluir uma coluna

1. Selecione o ícone de exclusão.
2. Escolha outra coluna para receber os cards existentes.
3. Confirme a exclusão.

Se houver outras colunas, a transferência preserva os itens e os reposiciona na coluna de destino. O status de cada card transferido é mantido; apenas a coluna muda. A aplicação não deixa cards apontando para uma coluna removida.

> [!warning] Última coluna
> Um projeto precisa manter uma etapa válida para receber trabalho. Antes de remover a única coluna, crie uma substituta: a exclusão da última coluna deixa o projeto sem fluxo e não é bloqueada automaticamente.

## Efeitos no Board

- A criação acrescenta uma nova área ao fluxo.
- A renomeação atualiza o título exibido no Board.
- A reordenação muda a sequência visual para todos.
- A movimentação de um card para outra coluna atualiza seu status.
- A exclusão transfere os cards antes de remover a etapa.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar colunas | Sim | Sim | Sim |
| Reordenar pelo Board | Sim | Sim | Não |
| Criar, renomear ou excluir | Sim | Não | Não |

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Swimlanes e Colunas|Swimlanes e colunas]]
- [[04 - Board e Visualizacoes/Criar Mover e Ordenar Cards|Criar, mover e ordenar cards]]
- [[10 - Referencia/Tipos Status e Prioridades|Tipos, status e prioridades]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

As colunas pertencem ao projeto e ao tenant e são ordenadas pelo campo de posição. A API exige papel `ADMIN` para criar, editar e excluir; a reordenação exige ao menos `MEMBER`.

Ao mover um card, o backend obtém o status base da coluna de destino e sincroniza o status do item. Na exclusão, a transferência dos itens e a remoção da coluna são executadas na mesma transação.

</details>

