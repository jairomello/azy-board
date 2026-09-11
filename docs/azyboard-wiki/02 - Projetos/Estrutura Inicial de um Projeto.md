---
title: Estrutura Inicial de um Projeto
type: guide
order: 3
---

# Estrutura Inicial de um Projeto

Todo projeto nasce com uma estrutura mínima para que a equipe possa começar a organizar o trabalho imediatamente. Os componentes variam conforme o modo escolhido na criação.

## Componentes criados automaticamente

### Administrador inicial e gerência

A pessoa que cria o projeto torna-se `Admin` e assume a gerência geral. Ela pode configurar a estrutura, adicionar participantes e distribuir permissões.

### Módulo Geral (modo hierárquico)

Em projetos do modo **Hierárquico**, o módulo **Geral** recebe os primeiros épicos do projeto e pode ser usado para trabalho que ainda não exige uma divisão funcional específica.

O administrador pode posteriormente:

- Renomear o módulo.
- Criar outros módulos.
- Mover épicos entre módulos.
- Excluir o módulo, transferindo ou removendo seus épicos conforme a ação escolhida.

### História fixa (modo simples)

Em projetos do modo **Simples**, não existe módulo. A aplicação cria a história fixa **Fluxo contínuo**, que recebe diretamente as tasks e bugs do projeto e dá nome à lane única do Board.

### Colunas do Board

| Ordem | Coluna | Status base |
|---:|---|---|
| 1 | Backlog | Não iniciada |
| 2 | A Fazer | Não iniciada |
| 3 | Fazendo | Em andamento |
| 4 | A Testar | Em andamento |
| 5 | Testando | Em andamento |
| 6 | Concluídas | Concluída |

As colunas representam etapas iniciais sugeridas. Elas podem ser reordenadas, renomeadas, criadas ou removidas de acordo com o fluxo da equipe.

## O que começa vazio

Um projeto novo não possui automaticamente:

- No modo hierárquico: épicos, histórias, tasks, bugs ou subtasks.
- No modo simples: tasks ou bugs dentro da história fixa.
- Outros membros ou squads.
- Tags.
- Sprints.
- Versões.
- Centros de custo.
- Checklists, atividades ou anexos.

O gerente geral já vem definido com o criador do projeto e pode ser alterado depois. Os demais elementos são adicionados conforme a necessidade do projeto.

## Sequência sugerida de preparação

1. Confirme o nome e o gerente geral do projeto.
2. Revise as colunas e seus status base.
3. Defina os módulos funcionais.
4. Cadastre versões e sprints de planejamento.
5. Cadastre centros de custo, se utilizados.
6. Crie os squads.
7. Adicione membros e atribua papéis.
8. Crie os primeiros épicos e histórias.
9. Detalhe o trabalho em tasks, bugs e subtasks.

Essa sequência é recomendada, mas não obrigatória. O projeto pode começar apenas com o módulo e as colunas padrão.

## Relação entre coluna e status

Cada coluna possui um status base. Quando um card é movido, o status do item acompanha o status base da coluna de destino.

Isso permite que duas ou mais colunas representem etapas diferentes com o mesmo status geral. Por exemplo, **Fazendo**, **A Testar** e **Testando** podem ser etapas distintas, mas todas representam trabalho em andamento.

## Permissões

| Ação | Admin | Membro | Visualizador |
|---|---:|---:|---:|
| Consultar estrutura | Sim | Sim | Sim |
| Criar itens | Sim | Sim | Não |
| Alterar módulos e colunas | Sim | Não | Não |
| Adicionar participantes | Sim | Não | Não |

## Exemplo prático

No projeto **Central de Atendimento**, a equipe mantém as colunas padrão, cria os módulos **Portal**, **Integrações** e **Relatórios**, cadastra a versão **v1.0** e organiza os participantes nos squads **Experiência** e **Plataforma**.

## Funcionalidades relacionadas

- [[02 - Projetos/Criar um Projeto|Criar um projeto]]
- [[03 - Estrutura do Trabalho/Estrutura do Trabalho|Estrutura do Trabalho]]
- [[07 - Configuracoes do Projeto/Configuracoes do Projeto|Configurações do Projeto]]

<details>
<summary><strong>Como funciona tecnicamente</strong></summary>

### Entidades iniciais

A criação estabelece registros para projeto, membership administrativa, módulo e colunas. Cada registro carrega o tenant e o identificador do projeto quando aplicável.

### Posição

Módulos e colunas possuem posição numérica. A posição inicial das colunas segue a ordem apresentada na tabela, e alterações posteriores atualizam essa ordenação.

### Status base

O status base é armazenado na coluna e utilizado pelo fluxo de movimentação para atualizar o item. O estado de arquivamento é tratado separadamente e não funciona como status base de coluna.

</details>

