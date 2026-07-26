---
title: Organizar Squads e Consultar a Estrutura
type: guide
order: 4
---

# Organizar Squads e Consultar a Estrutura

Squads agrupam membros do projeto em equipes de trabalho. Essa organização aparece nas configurações, na visão estrutural e nos filtros do Board.

## Onde encontrar

Na página **Configurações**, a seção **Membros & Squads** contém:

- a lista de squads e suas quantidades de membros;
- a lista de membros e seus vínculos;
- a ação **Ver estrutura**.

## Criar um squad

1. Informe um nome em **Nome do squad**.
2. Selecione **Criar squad**.

O novo squad aparece vazio e fica disponível para associação de membros.

## Renomear um squad

1. Selecione o ícone de edição.
2. Altere o nome.
3. Confirme no ícone de confirmação ou pressione `Enter`.

O novo nome passa a aparecer na lista de membros, na estrutura e nos filtros do Board.

## Associar membros

O vínculo é definido na edição ou inclusão do membro:

1. Abra o formulário do membro.
2. Escolha o squad.
3. Salve.

Cada associação ao projeto aponta para no máximo um squad. Escolha **Sem squad** para retirar apenas o vínculo organizacional, mantendo o acesso ao projeto.

## Consultar a estrutura

Selecione **Ver estrutura** para abrir uma visão consolidada. Ela apresenta:

1. o gerente geral no topo;
2. cada squad com sua quantidade de integrantes;
3. nome, e-mail e papel dos integrantes;
4. uma seção de pessoas sem squad.

Essa visão ajuda a identificar equipes vazias, pessoas ainda não alocadas e distribuição de papéis.

## Filtrar o Board por squad

No Board, o filtro de squad apresenta somente os cards atribuídos a integrantes do squad selecionado. Cards sem responsável ou atribuídos a pessoas de outros squads ficam ocultos enquanto o filtro estiver ativo.

## Excluir um squad

1. Selecione o ícone de exclusão.
2. Confira a quantidade de membros afetados.
3. Confirme.

O squad é removido, mas seus integrantes continuam no projeto com a indicação **Sem squad**. Cards e demais dados de trabalho não são excluídos.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar squads e estrutura | Sim | Sim | Sim |
| Usar o filtro de squad | Sim | Sim | Sim |
| Criar, renomear ou excluir | Sim | Não | Não |
| Associar ou desassociar membros | Sim | Não | Não |

## Funcionalidades relacionadas

- [[07 - Configuracoes do Projeto/Gerenciar Membros e Papeis|Gerenciar membros e papéis]]
- [[07 - Configuracoes do Projeto/Definir o Gerente Geral|Definir o gerente geral]]
- [[04 - Board e Visualizacoes/Filtros do Board|Filtros do Board]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

Squads pertencem ao projeto e ao tenant. O vínculo com a pessoa é armazenado na associação do membro ao projeto, e a listagem de squads calcula a quantidade de membros de cada grupo.

Excluir um squad executa uma transação que primeiro define como nulo o vínculo dos membros e depois remove o grupo. O filtro do Board resolve os identificadores dos integrantes e os combina com os demais filtros ativos.

</details>

