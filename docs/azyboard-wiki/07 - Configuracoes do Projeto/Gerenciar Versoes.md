---
title: Gerenciar Versões
type: guide
order: 7
---

# Gerenciar Versões

Versões agrupam itens destinados a uma entrega ou release. Elas permitem acompanhar o escopo planejado, em desenvolvimento, entregue ou cancelado.

## Onde encontrar

Na página **Configurações**, localize **Versões**. A lista apresenta nome, data de lançamento e situação. Todos podem abrir os detalhes; administradores também podem manter os registros.

## Situações de uma versão

| Situação | Uso |
|---|---|
| `PLANNED` | Entrega planejada, ainda não iniciada. |
| `IN_DEV` | Entrega em desenvolvimento. |
| `RELEASED` | Versão lançada. |
| `CANCELLED` | Entrega cancelada. |

## Criar uma versão

1. Selecione **Nova versão**.
2. Informe o nome obrigatório.
3. Defina uma data de lançamento, se conhecida.
4. Adicione uma descrição opcional.
5. Escolha a situação inicial.
6. Confirme a criação.

Novas versões normalmente começam como **Planejada**.

## Consultar detalhes e escopo

Selecione **Ver** para abrir a versão em modo somente leitura. A janela reúne:

- nome, data, descrição e situação;
- itens vinculados, com título, tipo e status;
- responsável de cada item, quando definido;
- paginação ou **Carregar mais** quando a lista exceder 20 itens.

Se ainda não existe escopo, a aplicação informa que nenhum item está vinculado.

## Editar uma versão

1. Selecione **Editar**.
2. Atualize os campos necessários.
3. Selecione **Salvar**.

Alterar a situação não movimenta cards nem conclui itens automaticamente. Ela representa o estado da entrega como um todo.

## Vincular itens

Nas modais de épicos, histórias, tasks e bugs, escolha uma opção no campo **Versão**. O vínculo é opcional e pode ser removido escolhendo **Sem versão**.

Quando o projeto não possui versões cadastradas, o campo pode ser ocultado.

## Excluir uma versão

1. Selecione **Excluir**.
2. Leia a confirmação.
3. Confirme.

Os itens vinculados não são excluídos. Eles permanecem no projeto e passam a ficar sem versão.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar versões e itens vinculados | Sim | Sim | Sim |
| Vincular versão a um item editável | Sim | Sim | Não |
| Criar, editar ou excluir versões | Sim | Não | Não |

## Funcionalidades relacionadas

- [[05 - Epicos e Historias/Criar e Gerenciar Epicos|Criar e gerenciar épicos]]
- [[05 - Epicos e Historias/Criar e Detalhar Historias|Criar e detalhar histórias]]
- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[07 - Configuracoes do Projeto/Gerenciar Sprints|Gerenciar sprints]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

Versões pertencem ao projeto e ao tenant, possuem posição, data opcional, descrição e situação enumerada. Cada item mantém uma referência opcional à versão.

As operações de manutenção exigem `ADMIN`; a consulta exige associação ao projeto. A listagem de itens da versão é paginada e retorna somente dados do mesmo tenant. Na exclusão, as referências dos itens são anuladas antes da remoção da versão.

</details>

