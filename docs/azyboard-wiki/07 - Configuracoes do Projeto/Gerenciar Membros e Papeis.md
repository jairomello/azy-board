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

1. Selecione **Adicionar membro**. Abre uma grade com as pessoas que ainda não participam do projeto, com as colunas **Nome**, **E-mail**, **Squad** e **Papel**.
2. Digite parte do nome ou do e-mail no campo de busca para reduzir a lista. A filtragem é rápida e consulta o ambiente organizacional inteiro, mesmo em empresas com milhares de pessoas.
3. Marque o **checkbox** à esquerda de cada pessoa que deseja incluir. É possível marcar várias de uma vez.
4. Ajuste **papel** e **squad** na própria linha, se necessário: cada pessoa pode entrar com valores diferentes.
5. Se a lista for longa, use **Carregar mais** (ou role a grade até o fim) para ver as próximas pessoas.
6. Confirme em **Confirmar** — todas as pessoas marcadas entram de uma só vez.

Os valores iniciais já vêm preenchidos: o papel é **Membro** para todas as pessoas e o squad é o único squad do projeto quando existe apenas um. Se o projeto não tiver squad, a pessoa entra sem squad; se tiver mais de um, o squad fica em branco para você escolher.

Quem já participa do projeto não aparece na grade. Ao confirmar, o sistema informa quantas pessoas entraram, quantas já eram membros e quantas não puderam ser incluídas (por exemplo, um squad removido nesse meio-tempo); nesse caso a grade permanece aberta para você revisar.

As pessoas marcadas continuam selecionadas mesmo se você mudar a busca ou carregar mais resultados — o contador acima dos botões mostra quantas estão selecionadas.

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

A lista de candidatos devolve os usuários do tenant ativo de forma paginada, com busca por nome ou e-mail resolvida no servidor; o recorte usado pela grade omite quem já possui associação ao projeto. A inclusão é feita em lote pelo identificador do usuário, sempre dentro do mesmo tenant, e devolve o resultado por entrada (criados, já membros e inválidos) — a duplicidade é descartada. O envio por e-mail continua aceito para agentes e clientes existentes. Alterações e remoções são filtradas por tenant e projeto. O middleware compara o papel mínimo de cada rota segundo a ordem `VIEWER < MEMBER < ADMIN`.

</details>

