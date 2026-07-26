---
title: Gerenciar Sprints
type: guide
order: 8
---

# Gerenciar Sprints

Sprints representam ciclos de execução com início e fim definidos. Elas agrupam cards selecionados para um período e permitem destacar o trabalho da sprint ativa no Board.

## Onde encontrar

As sprints são administradas nas **Configurações do Projeto** e aparecem como opção no filtro de sprint do Board. A sprint ativa também pode ser consultada por integrações e agentes de IA.

## Ciclo de vida

| Situação | Significado |
|---|---|
| `PLANNED` | Sprint planejada, ainda não ativa. |
| `ACTIVE` | Ciclo atualmente em execução. |
| `DONE` | Sprint encerrada. |

Somente uma sprint pode ficar ativa por projeto.

## Criar uma sprint

1. Selecione **Nova sprint**.
2. Informe o nome.
3. Defina as datas de início e fim.
4. Confirme.

A sprint é criada como **Planejada**. Membros podem preparar ciclos futuros; a ativação e o encerramento são controlados por administradores.

## Editar o planejamento

Enquanto a sprint não estiver encerrada, ajuste nome e datas para refletir o período acordado. A edição não altera automaticamente os itens vinculados.

## Adicionar ou remover cards

Abra um item e use o campo **Sprint** para incluí-lo em um ciclo. Remova a seleção quando o card não fizer mais parte daquele planejamento.

Um card sem sprint continua no projeto e aparece na visão **Todos**, mas não no filtro de uma sprint específica.

## Ativar uma sprint

1. Abra a sprint planejada.
2. Selecione **Ativar**.
3. Confirme.

Se outra sprint estiver ativa, ela deixa de ocupar esse estado para que o projeto mantenha apenas um ciclo corrente.

## Acompanhar no Board

Selecione a sprint na toolbar de filtros. O Board mantém somente os cards vinculados a ela e combina essa seleção com filtros de módulo, squad, responsável, tipo e tags.

## Encerrar uma sprint

1. Abra a sprint ativa.
2. Selecione **Encerrar**.
3. Confirme.

A sprint passa para **Concluída**. Cards não concluídos permanecem no projeto e podem ser incluídos na próxima sprint; o encerramento não os exclui e não muda seu status automaticamente.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar e filtrar por sprint | Sim | Sim | Sim |
| Criar sprint planejada | Sim | Sim | Não |
| Associar cards | Sim | Sim | Não |
| Editar, ativar ou encerrar | Sim | Não | Não |

## Funcionalidades relacionadas

- [[04 - Board e Visualizacoes/Filtros do Board|Filtros do Board]]
- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[07 - Configuracoes do Projeto/Gerenciar Versoes|Gerenciar versões]]
- [[09 - Agentes e Integracoes/Agentes e Integracoes|Agentes e integrações]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

Sprints pertencem ao projeto e ao tenant e armazenam nome, datas e situação. A associação entre itens e sprints é muitos para muitos, o que preserva o histórico de participação em ciclos.

A ativação é transacional: a sprint ativa anterior volta ao estado planejado e a selecionada passa a `ACTIVE`. O encerramento define `DONE`. A consulta da sprint corrente retorna seus dados ou `status: NONE`, formato usado também por agentes de IA.

</details>

