---
title: Definir o Gerente Geral
type: guide
order: 2
---

# Definir o Gerente Geral

O gerente geral identifica a pessoa com responsabilidade global pelo projeto. Essa atribuição oferece uma referência organizacional e não substitui os papéis de acesso do projeto.

## Onde encontrar

Na página **Configurações**, localize **Gerente Geral do Projeto**. Quando existe um gerente definido, a seção apresenta seu nome, e-mail e avatar ou inicial.

## Definir ou trocar o gerente

1. Abra o seletor de membros.
2. Escolha a pessoa que assumirá a função.
3. Selecione **Salvar**.

Somente membros atuais do projeto aparecem como opções. Para escolher outra pessoa, primeiro adicione-a ao projeto.

## Remover a definição

1. Escolha **Sem gerente**.
2. Selecione **Salvar**.

O projeto continua funcionando normalmente e passa a ser exibido sem gerente geral definido.

## Gerente geral e papel de acesso

São conceitos independentes:

| Conceito | Determina |
|---|---|
| Gerente geral | Referência de responsabilidade pelo projeto. |
| Papel `ADMIN` | Permissão para administrar estrutura e participantes. |
| Papel `MEMBER` | Permissão para executar e atualizar o trabalho. |
| Papel `VIEWER` | Permissão de consulta. |

Definir uma pessoa como gerente não altera automaticamente seu papel. Verifique se ela possui as permissões adequadas às atividades que deverá realizar.

## Ao remover um membro

Se a pessoa definida como gerente deixar o projeto, defina outro gerente ou deixe o campo vazio. A referência de gerente nunca deve permitir acesso a quem já não participa do projeto.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar o gerente | Sim | Sim | Sim |
| Definir, trocar ou remover | Sim | Não | Não |

## Funcionalidades relacionadas

- [[07 - Configuracoes do Projeto/Gerenciar Membros e Papeis|Gerenciar membros e papéis]]
- [[07 - Configuracoes do Projeto/Organizar Squads e Consultar a Estrutura|Organizar squads e consultar a estrutura]]
- [[10 - Referencia/Perfis e Permissoes|Perfis e permissões]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O projeto armazena uma referência opcional para o usuário gerente. A atualização aceita um identificador de membro ou `null` e exige papel `ADMIN`.

O backend valida o projeto no tenant autenticado e confirma que o usuário escolhido possui associação com o projeto. A consulta do projeto resolve também os dados públicos usados para apresentar o gerente.

</details>

