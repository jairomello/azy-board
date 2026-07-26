---
title: Gerenciar Membros e Papéis
type: guide
order: 3
---

# Gerenciar Membros e Papéis

Os membros são as pessoas autorizadas a acessar um projeto. Cada associação possui um papel e pode, opcionalmente, apontar para um squad.

## Onde encontrar

Na página **Configurações**, acesse a seção **Membros & Squads** e localize **Membros do Projeto**. A lista apresenta nome, e-mail, papel e squad de cada pessoa.

## Entender os papéis

| Papel | Uso funcional |
|---|---|
| `Admin` | Administra o fluxo, a estrutura, o planejamento e os participantes. |
| `Membro` | Cria e atualiza itens, movimenta trabalho e participa da execução. |
| `Visualizador` | Consulta o projeto sem modificar seu conteúdo. |

O papel vale para aquele projeto. Uma pessoa pode ser administradora em um projeto e visualizadora em outro.

## Adicionar um membro

1. Selecione **Adicionar membro**.
2. Informe o e-mail da pessoa.
3. Escolha o papel inicial.
4. Se desejar, escolha um squad.
5. Confirme em **Adicionar**.

A pessoa precisa possuir uma conta no mesmo ambiente organizacional. Um usuário já associado ao projeto não pode ser adicionado novamente.

## Editar papel ou squad

1. Selecione o ícone de edição ao lado do membro.
2. Altere o papel, o squad ou ambos.
3. Selecione **Salvar**.

Escolha **Sem squad** para manter a pessoa no projeto sem vínculo com uma equipe específica.

## Remover um membro

1. Selecione o ícone de remoção.
2. Confira o nome e o e-mail apresentados na confirmação.
3. Confirme em **Remover**.

A remoção encerra o acesso ao projeto e elimina a associação ao squad. Os itens anteriormente atribuídos à pessoa são preservados; revise os responsáveis para evitar trabalho sem acompanhamento.

> [!warning] Continuidade administrativa
> Antes de remover ou rebaixar um administrador, confirme que outro membro continuará com acesso administrativo ao projeto.

## Membros como responsáveis

Os membros disponíveis alimentam o campo **Responsável** dos itens. Ao adicionar uma pessoa, ela passa a poder ser escolhida em cards; ao removê-la, deixa de aparecer para novas atribuições.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar a lista | Sim | Sim | Sim |
| Adicionar membro | Sim | Não | Não |
| Alterar papel ou squad | Sim | Não | Não |
| Remover membro | Sim | Não | Não |

## Boas práticas

- Conceda `Admin` somente a quem administra o projeto.
- Use `Visualizador` para acompanhamento sem operação.
- Revise acessos quando a composição da equipe mudar.
- Reatribua itens antes de remover uma pessoa.
- Mantenha pelo menos um administrador ativo.

## Funcionalidades relacionadas

- [[07 - Configuracoes do Projeto/Definir o Gerente Geral|Definir o gerente geral]]
- [[07 - Configuracoes do Projeto/Organizar Squads e Consultar a Estrutura|Organizar squads e consultar a estrutura]]
- [[06 - Tasks Bugs e Subtasks/Criar e Editar Tasks e Bugs|Criar e editar tasks e bugs]]
- [[10 - Referencia/Perfis e Permissoes|Perfis e permissões]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

O acesso é representado por uma associação entre usuário, projeto e tenant. Ela armazena o papel e uma referência opcional ao squad.

Ao adicionar alguém, o backend procura o e-mail no mesmo tenant, rejeita duplicidade e cria a associação. Alterações e remoções são filtradas por tenant e projeto. O middleware compara o papel mínimo de cada rota segundo a ordem `VIEWER < MEMBER < ADMIN`.

</details>

