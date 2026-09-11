---
title: Arquivar, Restaurar e Excluir Itens
type: guide
order: 7
---

# Arquivar, Restaurar e Excluir Itens

Arquivar retira um item das visualizações ativas sem perder sua estrutura. Excluir remove permanentemente o item e seus dados relacionados.

## Arquivar um card no Board

1. Posicione o cursor sobre o card.
2. Selecione a ação de arquivamento.
3. Se o item possuir descendentes, confira a quantidade informada.
4. Confirme **Arquivar tudo**.

Um item folha é arquivado imediatamente, pois não existem descendentes afetados.

## Arquivar pela árvore

1. Abra a Tree View.
2. Localize o item.
3. Use a ação de arquivamento na linha.
4. Confirme o impacto quando houver filhos.

Módulos não são arquiváveis. Épicos, histórias, tasks e bugs são.

## Arquivamento em cascata

Arquivar um item pai arquiva toda a subárvore:

- Arquivar um épico inclui histórias, tasks, bugs e subtasks.
- Arquivar uma história inclui todos os itens abaixo dela.
- Arquivar uma task pai inclui suas subtasks.
- Arquivar uma folha afeta somente ela.

O status anterior de cada item é preservado individualmente.

## Consultar itens arquivados

1. No Board, selecione **Itens arquivados** na barra de comandos.
2. A janela apresenta uma tabela com:
   - Tipo.
   - Título.
   - Épico ancestral, quando aplicável.
   - Estado anterior.
   - Data do arquivamento.
   - Ação **Restaurar**.

Quando não existem itens arquivados, a janela apresenta uma mensagem de estado vazio.

## Restaurar um item

1. Abra **Itens arquivados**.
2. Localize o item.
3. Selecione **Restaurar**.
4. Aguarde seu retorno ao Board e à árvore.

O item retorna ao status que possuía antes do arquivamento. Quando esse status não está disponível, retorna como não iniciado.

## Restauração em cascata

- Restaurar um pai restaura seus descendentes arquivados.
- Restaurar um descendente também restaura ancestrais arquivados necessários para torná-lo visível.
- Cada item recupera seu próprio status anterior.

## Excluir um item

1. Posicione o cursor sobre o card.
2. Selecione a ação de exclusão.
3. Leia a confirmação.
4. Confirme somente se os dados puderem ser removidos permanentemente.

## O que é removido na exclusão

A exclusão em cascata inclui:

- O item selecionado.
- Todos os descendentes.
- Associações com tags e sprints.
- Checklists e seus itens.
- Histórico de atividades.
- Anexos e referências relacionadas.

> [!danger] Sem restauração
> Itens excluídos não aparecem na janela de arquivados e não podem ser restaurados pelo Azy Board.

## Quando usar cada ação

| Necessidade | Ação recomendada |
|---|---|
| Retirar trabalho antigo das visões ativas | Arquivar |
| Suspender temporariamente uma estrutura | Arquivar |
| Recuperar trabalho retirado | Restaurar |
| Remover cadastro incorreto ou descartável | Excluir |
| Preservar histórico e relações | Arquivar |

## Permissões

`Admin` e `Membro` podem arquivar, restaurar e excluir itens. `Visualizador` pode apenas consultar itens ativos.

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Criar Mover e Ordenar Cards|Criar, mover e ordenar cards]]
- [[04 - Board e Visualizacoes/Visualizacao em Arvore|Visualização em árvore]]
- [[06 - Tasks Bugs e Subtasks/Tasks Bugs e Subtasks|Tasks, Bugs e Subtasks]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Arquivamento

A API percorre os descendentes, preserva o status atual no campo de restauração e altera toda a subárvore para `ARCHIVED` em uma transação. Consultas normais excluem esse status.

### Restauração

O serviço coleta descendentes arquivados e ancestrais necessários. Cada registro recupera `statusBeforeArchive`, que é limpo depois da operação.

### Exclusão

A exclusão coleta toda a subárvore e remove relações dependentes antes dos itens. O tenant e o projeto são validados para impedir operações sobre dados externos ao contexto autenticado.

</details>

